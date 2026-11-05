import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  ConnectivityService() {
    _subscription = Connectivity().onConnectivityChanged.listen(_onChange);
    _refresh();
  }

  final _controller = StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _online = true;

  bool get isOnline => _online;

  Stream<bool> get onlineChanges => _controller.stream;

  Future<bool> checkOnline() async {
    await _refresh();
    return _online;
  }

  Future<void> _refresh() async {
    final results = await Connectivity().checkConnectivity();
    _setOnline(_hasNetwork(results));
  }

  void _onChange(List<ConnectivityResult> results) {
    _setOnline(_hasNetwork(results));
  }

  bool _hasNetwork(List<ConnectivityResult> results) {
    if (results.isEmpty) return false;
    return results.any((r) => r != ConnectivityResult.none);
  }

  void _setOnline(bool value) {
    if (_online == value) return;
    _online = value;
    _controller.add(value);
  }

  void dispose() {
    _subscription?.cancel();
    _controller.close();
  }
}
