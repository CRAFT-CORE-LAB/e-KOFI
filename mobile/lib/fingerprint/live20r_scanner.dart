import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:zkfinger10/finger_status_type.dart';
import 'package:zkfinger10/zk_finger.dart';

import 'pc_scanner_client.dart';

class _UsbReaderStatus {
  const _UsbReaderStatus({required this.present, required this.permitted});

  final bool present;
  final bool permitted;
}

class Live20RScanner {
  static const _usbChannel = MethodChannel('ekofi/usb_reader');

  // The plugin exposes one native event channel, so every scanner shares a single subscription.
  static final Stream<dynamic> _events = ZkFinger.statusChangeStream.receiveBroadcastStream();
  static final Stream<dynamic> _imageEvents = ZkFinger.imageStream.receiveBroadcastStream();

  StreamSubscription<dynamic>? _statusSub;
  StreamSubscription<dynamic>? _imageSub;
  final _statusController = StreamController<String>.broadcast();
  final _imageController = StreamController<Uint8List>.broadcast();
  PcScannerClient? _pc;
  bool _usb = false;

  Stream<String> get status => _statusController.stream;
  Stream<Uint8List> get images => _imageController.stream;

  bool get onPhone => _usb;

  Future<void> connect({String? studentId}) async {
    _pc = null;
    if (!kIsWeb && Platform.isAndroid) {
      var usb = await _usbStatus();
      for (var attempt = 0; attempt < 4 && !usb.present; attempt++) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        usb = await _usbStatus();
      }
      if (usb.present) {
        await _connectUsb(usb);
        return;
      }
    }
    _statusController.add('No reader on this phone. Looking for the one on the computer…');
    try {
      final pcUrl = await PcScannerClient.discover();
      if (pcUrl != null) {
        final client = PcScannerClient(pcUrl);
        await client.connect();
        _pc = client;
        _statusController.add('Computer reader is ready. Ask the student to place a finger on the glass.');
        return;
      }
    } catch (error) {
      final text = '$error'.replaceFirst('Exception: ', '');
      throw Exception(text);
    }
    throw Exception(
      'No fingerprint reader found. Plug the Live20R into this phone with a USB OTG adapter and tap Allow, '
      'or plug it into the computer and start the e-KOFI reader there.',
    );
  }

  Future<void> disconnect() async {
    _pc = null;
    if (_usb) {
      _usb = false;
      try {
        await ZkFinger.closeConnection();
      } catch (_) {}
    }
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
    if (_pc != null) {
      return _pc!.identify(templates);
    }
    _ensureUsb();
    if (templates.isEmpty) {
      throw Exception('No fingerprints are registered yet. Register a student first.');
    }
    final keys = <String, String>{};
    final load = <String, String>{};
    var index = 1;
    for (final entry in templates.entries) {
      final key = '${index++}';
      keys[key] = entry.key;
      load[key] = entry.value;
    }
    await ZkFinger.clearAndLoadDatabase(vUserList: load);

    final done = Completer<String>();
    final sub = _events.listen((value) {
      if (done.isCompleted) return;
      final type = _typeOf(value);
      if (type == FingerStatusType.IDENTIFIED_SUCCESS) {
        final id = keys['${(value as Map)['id'] ?? ''}'.trim()];
        if (id != null) {
          done.complete(id);
        } else {
          done.completeError(Exception('No matching student. Register this fingerprint in the admin screen first.'));
        }
      } else if (type == FingerStatusType.IDENTIFIED_FAILED) {
        done.completeError(Exception('No matching student. Register this fingerprint in the admin screen first.'));
      } else if (type == FingerStatusType.IDENTIFIED_START_FIRST) {
        _usb = false;
        done.completeError(Exception('The reader stopped. Tap Connect reader again.'));
      }
    });
    try {
      await ZkFinger.identify();
      return await done.future.timeout(
        const Duration(seconds: 45),
        onTimeout: () => throw Exception('No fingerprint was captured. Keep the finger still on the glass.'),
      );
    } finally {
      await sub.cancel();
    }
  }

  Future<String> enroll({required String studentId}) async {
    if (_pc != null) {
      return _pc!.enroll();
    }
    _ensureUsb();
    await ZkFinger.clearFingerDatabase();

    final done = Completer<String>();
    final sub = _events.listen((value) {
      if (done.isCompleted) return;
      final type = _typeOf(value);
      if (type == null) return;
      final data = '${(value as Map)['data'] ?? ''}';
      if (type == FingerStatusType.ENROLL_SUCCESS && data.length >= 20) {
        done.complete(data);
      } else if (type == FingerStatusType.ENROLL_STARTED && data.isNotEmpty && data != '3') {
        done.completeError(Exception('Use the same finger all three times. Tap Capture fingerprint to try again.'));
      } else if (type == FingerStatusType.ENROLL_ALREADY_EXIST) {
        done.completeError(Exception('This finger is already saved. Try a different finger.'));
      } else if (type == FingerStatusType.ENROLL_FAILED) {
        done.completeError(Exception('The fingerprint was not clear enough. Lift the finger and try again.'));
      } else if (type == FingerStatusType.IDENTIFIED_START_FIRST) {
        _usb = false;
        done.completeError(Exception('The reader stopped. Tap Connect reader again.'));
      }
    });
    try {
      await ZkFinger.registerFinger(userId: 'enroll');
      return await done.future.timeout(
        const Duration(seconds: 60),
        onTimeout: () => throw Exception('No fingerprint was captured. Keep the finger still on the glass.'),
      );
    } finally {
      await sub.cancel();
    }
  }

  Future<void> _connectUsb(_UsbReaderStatus usb) async {
    _attachStreams();
    _statusController.add(
      usb.permitted
          ? 'Opening the reader on this phone…'
          : 'Reader found on this phone. Tap Allow when the phone asks for USB access.',
    );
    final access = await _usbChannel.invokeMethod<String>('requestAccess');
    if (access == 'denied') {
      throw Exception('USB access was denied. Unplug the reader, plug it back in, and tap Allow.');
    }
    if (access != 'granted') {
      throw Exception(
        'The phone lost the reader. Use a USB OTG adapter, then unplug it and plug it in again.',
      );
    }

    final started = Completer<void>();
    final sub = _events.listen((value) {
      if (started.isCompleted) return;
      final type = _typeOf(value);
      if (type == FingerStatusType.STARTED_SUCCESS || type == FingerStatusType.STARTED_ALREADY) {
        started.complete();
      } else if (type == FingerStatusType.STARTED_ERROR) {
        started.completeError(Exception('The phone cannot see the reader. Unplug it, plug it back in, and try again.'));
      } else if (type == FingerStatusType.STARTED_FAILED) {
        started.completeError(
          Exception('The reader did not start. Unplug it, plug it back in, allow USB access, and try again.'),
        );
      }
    });

    try {
      await ZkFinger.openConnection();
      try {
        await started.future.timeout(const Duration(seconds: 8));
      } on TimeoutException {
        await ZkFinger.openConnection();
        await started.future.timeout(
          const Duration(seconds: 8),
          onTimeout: () => throw Exception('The reader did not start. Unplug it, plug it back in, and tap Connect reader again.'),
        );
      }
      _usb = true;
      _statusController.add('Phone reader is ready. Ask the student to place a finger on the glass.');
    } finally {
      await sub.cancel();
    }
  }

  Future<_UsbReaderStatus> _usbStatus() async {
    try {
      final raw = await _usbChannel.invokeMapMethod<String, dynamic>('status');
      return _UsbReaderStatus(
        present: raw?['present'] == true,
        permitted: raw?['permitted'] == true,
      );
    } catch (_) {
      return const _UsbReaderStatus(present: false, permitted: false);
    }
  }

  void _attachStreams() {
    _statusSub ??= _events.listen((value) {
      final type = _typeOf(value);
      if (type == null) return;
      final message = _friendlyStatus(type, '${(value as Map)['message'] ?? ''}');
      if (message != null) _statusController.add(message);
    });
    _imageSub ??= _imageEvents.listen((event) {
      if (event is Uint8List) {
        _imageController.add(event);
      } else if (event is List<int>) {
        _imageController.add(Uint8List.fromList(event));
      }
    });
  }

  FingerStatusType? _typeOf(dynamic value) {
    if (value is! Map) return null;
    final index = value['fingerStatus'];
    if (index is! int || index < 0 || index >= FingerStatusType.values.length) return null;
    return FingerStatusType.values[index];
  }

  String? _friendlyStatus(FingerStatusType type, String message) {
    switch (type) {
      case FingerStatusType.ENROLL_STARTED:
        return 'Place the same finger on the glass three times.';
      case FingerStatusType.ENROLL_CONFIRM:
        return 'Good. Lift and place the same finger again.';
      case FingerStatusType.ENROLL_SUCCESS:
        return 'Fingerprint captured.';
      case FingerStatusType.ENROLL_ALREADY_EXIST:
        return 'This finger is already registered.';
      case FingerStatusType.IDENTIFIED_SUCCESS:
        return 'Student recognised.';
      case FingerStatusType.IDENTIFIED_FAILED:
        return 'No matching student for this fingerprint.';
      case FingerStatusType.STARTED_SUCCESS:
      case FingerStatusType.STARTED_ALREADY:
        return 'Reader is ready.';
      case FingerStatusType.FINGER_EXTRACTED:
      case FingerStatusType.FINGER_CLEARED:
      case FingerStatusType.FINGER_CLEARED_AND_LOADED:
      case FingerStatusType.STOPPED_ALREADY:
      case FingerStatusType.STOPPED_SUCCESS:
      case FingerStatusType.FINGER_USB_PERMISSION_DENIED:
      case FingerStatusType.FINGER_USB_PERMISSION_GRANTED:
        return null;
      default:
        return message.isEmpty ? null : message;
    }
  }

  void _ensureUsb() {
    if (!_usb) {
      throw Exception('Connect the fingerprint reader first.');
    }
  }
}
