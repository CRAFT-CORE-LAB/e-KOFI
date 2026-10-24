import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:zkfinger10/finger_status_type.dart';
import 'package:zkfinger10/zk_finger.dart';

class Live20RScanner {
  StreamSubscription<dynamic>? _statusSub;
  StreamSubscription<dynamic>? _imageSub;
  final _statusController = StreamController<String>.broadcast();
  final _imageController = StreamController<Uint8List>.broadcast();

  Stream<String> get status => _statusController.stream;
  Stream<Uint8List> get images => _imageController.stream;

  Future<void> connect({String? studentId}) async {
    _ensureAndroid();
    await _listen();
    final opened = await ZkFinger.openConnection();
    if (opened == false) {
      throw Exception('Could not open the fingerprint reader. Check the USB cable and try again.');
    }
    await ZkFinger.startListen(userId: studentId);
  }

  Future<void> disconnect() async {
    try {
      await ZkFinger.stopListen();
    } catch (_) {}
    try {
      await ZkFinger.closeConnection();
    } catch (_) {}
    await _statusSub?.cancel();
    await _imageSub?.cancel();
    _statusSub = null;
    _imageSub = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _statusController.close();
    await _imageController.close();
  }

  Future<String> identify({required Map<String, String> templates}) async {
    _ensureAndroid();
    if (templates.isEmpty) {
      throw Exception('No fingerprints are registered yet. Register a student first.');
    }
    await ZkFinger.clearAndLoadDatabase(vUserList: templates);
    await ZkFinger.startListen();
    final done = Completer<String>();
    late final StreamSubscription<dynamic> sub;
    sub = ZkFinger.statusChangeStream.receiveBroadcastStream().listen((value) {
      if (done.isCompleted || value is! Map) return;
      final index = value['fingerStatus'];
      if (index is! int || index < 0 || index >= FingerStatusType.values.length) return;
      final type = FingerStatusType.values[index];
      final id = '${value['id'] ?? ''}';
      final message = '${value['message'] ?? type.name}';
      _statusController.add(_friendlyStatus(type, message));
      if (type == FingerStatusType.IDENTIFIED_SUCCESS && id.isNotEmpty) {
        done.complete(id);
      } else if (type == FingerStatusType.IDENTIFIED_FAILED) {
        done.completeError(
          Exception('No matching student. Register this fingerprint in the admin screen first.'),
        );
      } else if (type == FingerStatusType.FINGER_USB_PERMISSION_DENIED) {
        done.completeError(Exception('Allow USB access when the phone asks, then try again.'));
      }
    });
    try {
      final started = await ZkFinger.identify();
      if (started == false) {
        throw Exception('Could not start fingerprint recognition. Reconnect the reader and try again.');
      }
      return await done.future.timeout(
        const Duration(seconds: 45),
        onTimeout: () => throw Exception('No fingerprint was captured. Keep the finger still on the glass.'),
      );
    } finally {
      await sub.cancel();
    }
  }

  Future<String> enroll({required String studentId}) async {
    _ensureAndroid();
    await ZkFinger.startListen(userId: studentId);
    final done = Completer<String>();
    late final StreamSubscription<dynamic> sub;
    sub = ZkFinger.statusChangeStream.receiveBroadcastStream().listen((value) {
      if (done.isCompleted || value is! Map) return;
      final index = value['fingerStatus'];
      if (index is! int || index < 0 || index >= FingerStatusType.values.length) return;
      final type = FingerStatusType.values[index];
      final data = '${value['data'] ?? ''}';
      final message = '${value['message'] ?? type.name}';
      _statusController.add(_friendlyStatus(type, message));
      if (type == FingerStatusType.ENROLL_SUCCESS && data.length >= 20) {
        done.complete(data);
      } else if (type == FingerStatusType.ENROLL_ALREADY_EXIST) {
        ZkFinger.getUserFeature(userId: studentId).then((feature) {
          if (!done.isCompleted && feature != null && feature.length >= 20) {
            done.complete(feature);
          }
        });
      } else if (type == FingerStatusType.ENROLL_FAILED) {
        done.completeError(Exception('The fingerprint was not clear enough. Lift the finger and try again.'));
      } else if (type == FingerStatusType.FINGER_USB_PERMISSION_DENIED) {
        done.completeError(Exception('Allow USB access when the phone asks, then try again.'));
      }
    });
    try {
      final started = await ZkFinger.registerFinger(userId: studentId);
      if (started == false) {
        throw Exception('Could not start fingerprint capture. Reconnect the reader and try again.');
      }
      return await done.future.timeout(
        const Duration(seconds: 60),
        onTimeout: () => throw Exception('No fingerprint was captured. Keep the finger still on the glass.'),
      );
    } finally {
      await sub.cancel();
    }
  }

  Future<void> _listen() async {
    await _statusSub?.cancel();
    await _imageSub?.cancel();
    _statusSub = ZkFinger.statusChangeStream.receiveBroadcastStream().listen((value) {
      if (value is Map) {
        final index = value['fingerStatus'];
        final message = '${value['message'] ?? ''}';
        if (index is int && index >= 0 && index < FingerStatusType.values.length) {
          _statusController.add(_friendlyStatus(FingerStatusType.values[index], message));
        } else if (message.isNotEmpty) {
          _statusController.add(message);
        }
      }
    });
    _imageSub = ZkFinger.imageStream.receiveBroadcastStream().listen((event) {
      if (event is Uint8List) {
        _imageController.add(event);
      } else if (event is List<int>) {
        _imageController.add(Uint8List.fromList(event));
      }
    });
  }

  String _friendlyStatus(FingerStatusType type, String message) {
    switch (type) {
      case FingerStatusType.ENROLL_STARTED:
      case FingerStatusType.ENROLL_CONFIRM:
        return 'Keep placing the same finger until it is saved.';
      case FingerStatusType.ENROLL_SUCCESS:
        return 'Fingerprint captured.';
      case FingerStatusType.ENROLL_ALREADY_EXIST:
        return 'This finger is already registered.';
      case FingerStatusType.FINGER_USB_PERMISSION_GRANTED:
        return 'USB reader allowed. You can capture now.';
      case FingerStatusType.FINGER_USB_PERMISSION_DENIED:
        return 'USB access was denied. Unplug, plug in again, and allow access.';
      case FingerStatusType.IDENTIFIED_SUCCESS:
        return 'Student recognised.';
      case FingerStatusType.IDENTIFIED_FAILED:
        return 'No matching student for this fingerprint.';
      case FingerStatusType.STARTED_SUCCESS:
      case FingerStatusType.MOUNTED:
        return 'Reader is ready.';
      default:
        return message.isEmpty ? 'Waiting for the fingerprint reader…' : message;
    }
  }

  void _ensureAndroid() {
    if (kIsWeb || !Platform.isAndroid) {
      throw Exception('Plug the Live20R into an Android phone with a USB adapter.');
    }
  }
}
