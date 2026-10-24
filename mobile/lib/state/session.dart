import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onAuthLost = notifyListeners;
  }

  final ApiClient api;

  bool ready = false;
  bool busy = false;
  String? error;

  AuthUser? get user => api.user;
  bool get isLoggedIn => api.token != null && api.user != null;
  bool get isAdmin => user?.isAdmin ?? false;
  bool get isCanteen => user?.isCanteen ?? false;

  Future<void> bootstrap() async {
    try {
      await api.load().timeout(const Duration(seconds: 2));
    } catch (_) {
      // Prefs can fail on first launch; still show login.
    } finally {
      ready = true;
      notifyListeners();
    }
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
