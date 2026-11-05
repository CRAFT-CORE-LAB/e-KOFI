import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onAuthLost = notifyListeners;
    api.onSyncStateChanged = notifyListeners;
  }

  final ApiClient api;
  StreamSubscription<bool>? _onlineSub;

  bool ready = false;
  bool busy = false;
  String? error;

  AuthUser? get user => api.user;
  PortalStudent? get portal => api.portal;
  bool get isParent => api.audience == 'parent' && api.token != null && api.portal != null;
  bool get isStudent => api.audience == 'student' && api.token != null && api.portal != null;
  bool get isLoggedIn => api.token != null && (api.user != null || isParent || isStudent);
  bool get isAdmin => user?.isAdmin ?? false;
  bool get isCanteen => user?.isCanteen ?? false;
  bool get isOwner => user?.isOwner ?? false;
  bool get isOnline => api.connectivity.isOnline;
  int get pendingSyncCount => api.pendingSyncCount;
  bool get syncInProgress => api.syncInProgress;

  Future<void> bootstrap() async {
    try {
      await api.load().timeout(const Duration(seconds: 2));
      await api.refreshSyncState();
      _onlineSub ??= api.connectivity.onlineChanges.listen((online) {
        if (online) {
          unawaited(api.syncPending());
        }
        notifyListeners();
      });
      if (isLoggedIn && user != null) {
        unawaited(api.warmCache());
      }
    } catch (_) {
      // Prefs can fail on first launch; still show login.
    } finally {
      ready = true;
      notifyListeners();
    }
  }

  Future<void> syncNow() => api.syncPending();

  @override
  void dispose() {
    _onlineSub?.cancel();
    super.dispose();
  }

  Future<bool> login(String email, String password) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.login(email, password);
      return true;
    } on ApiException catch (e) {
      final raw = e.message.toLowerCase();
      if (raw.contains('credential') || raw.contains('unauthorized') || e.statusCode == 401) {
        error = 'Email or password is incorrect.';
      } else if (raw.contains('api') || raw.contains('http') || raw.contains('url')) {
        error = 'Unable to connect right now. Try again in a moment.';
      } else {
        error = e.message;
      }
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<StudentLookup> lookupStudent(String studentCode) {
    return api.lookupStudent(studentCode);
  }

  Future<void> openParent(String studentCode) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.openParentSession(studentCode);
    } on ApiException catch (e) {
      error = e.message;
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> registerStudent({required String studentCode, required String password}) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.registerStudentPortal(studentCode: studentCode, password: password);
    } on ApiException catch (e) {
      error = e.message;
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> loginStudent(String studentCode, String password) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.loginStudentPortal(studentCode: studentCode, password: password);
      return true;
    } on ApiException catch (e) {
      final raw = e.message.toLowerCase();
      if (raw.contains('password') || raw.contains('credential') || e.statusCode == 401) {
        error = 'Student ID or password is incorrect.';
      } else {
        error = e.message;
      }
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.register(name: name, email: email, password: password, role: role);
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        throw Exception('This email is already registered. Sign in instead.');
      }
      throw Exception(e.message);
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> changeEmail({required String email, required String password}) async {
    await api.changeEmail(email: email, password: password);
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    notifyListeners();
  }

  Future<void> updateApiUrl(String url) async {
    await api.setBaseUrl(url);
    notifyListeners();
  }

  Future<void> updateScannerUrl(String url) async {
    await api.setScannerUrl(url);
    notifyListeners();
  }
}
