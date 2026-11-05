import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models.dart';
import '../offline/connectivity_service.dart';
import '../offline/local_store.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({ConnectivityService? connectivity, LocalStore? local})
    : connectivity = connectivity ?? ConnectivityService(),
      local = local ?? LocalStore();

  static const _tokenKey = 'ekofi_token';
  static const _userKey = 'ekofi_user';
  static const _urlKey = 'ekofi_api_url';
  static const _scannerKey = 'ekofi_scanner_url';
  static const _audienceKey = 'ekofi_audience';
  static const _portalKey = 'ekofi_portal';

  final _uuid = const Uuid();
  final ConnectivityService connectivity;
  final LocalStore local;

  String baseUrl = defaultApiUrl();
  String scannerUrl = '';
  String? token;
  AuthUser? user;

  /// staff, parent, or student. Parent and student sessions are not staff accounts.
  String audience = 'staff';
  PortalStudent? portal;
  void Function()? onAuthLost;
  void Function()? onSyncStateChanged;

  /// True when the last read used saved data or the device has no network.
  bool servingFromCache = false;
  int pendingSyncCount = 0;
  bool syncInProgress = false;
  String? lastSyncMessage;

  static const railwayApiUrl = 'https://api-production-240da.up.railway.app/api';

  static String defaultApiUrl() => railwayApiUrl;

  static bool _isLocalApiUrl(String url) {
    return url.contains('10.0.2.2') ||
        url.contains('127.0.0.1') ||
        url.contains('localhost') ||
        url.contains('192.168.') ||
        url.contains(':3001');
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_urlKey);
    if (saved == null || _isLocalApiUrl(saved)) {
      baseUrl = defaultApiUrl();
      await prefs.setString(_urlKey, baseUrl);
    } else {
      baseUrl = saved;
    }
    scannerUrl = prefs.getString(_scannerKey) ?? '';
    token = prefs.getString(_tokenKey);
    audience = prefs.getString(_audienceKey) ?? 'staff';
    if (audience == 'parent' || audience == 'student') {
      final portalRaw = prefs.getString(_portalKey);
      if (token == null || portalRaw == null) {
        token = null;
        portal = null;
        audience = 'staff';
        return;
      }
      try {
        portal = PortalStudent.fromJson(jsonDecode(portalRaw) as Map<String, dynamic>);
        user = null;
      } catch (_) {
        token = null;
        portal = null;
        audience = 'staff';
      }
      return;
    }
    final raw = prefs.getString(_userKey);
    if (raw != null) {
      try {
        user = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        user = null;
        token = null;
      }
    }
  }

  Future<void> setBaseUrl(String url) async {
    baseUrl = url.trim().replaceAll(RegExp(r'/$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, baseUrl);
  }

  Future<void> setScannerUrl(String url) async {
    scannerUrl = url.trim().replaceAll(RegExp(r'/$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_scannerKey, scannerUrl);
  }

  Future<AuthUser> login(String email, String password) async {
    final loginId = email.trim().toLowerCase();
    if (!await connectivity.checkOnline()) {
      await _restoreOffline(kind: 'staff', loginId: loginId, secret: password);
      return user!;
    }
    try {
      final data = await _request(
        'POST',
        '/auth/login',
        body: {'email': email, 'password': password},
        auth: false,
      );
      final signedIn = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
      await _persistStaff(data['accessToken'] as String, signedIn);
      await _rememberOffline(
        kind: 'staff',
        loginId: loginId,
        secret: password,
        accessToken: token!,
        signedIn: signedIn,
      );
      await warmCache();
      return user!;
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _restoreOffline(kind: 'staff', loginId: loginId, secret: password);
      return user!;
    }
  }

  Future<AuthUser> register({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    final data = await _request(
      'POST',
      '/auth/register',
      body: {
        'name': name,
        'email': email,
        'password': password,
        'role': role,
      },
      auth: false,
    );
    final signedIn = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    await _persistStaff(data['accessToken'] as String, signedIn);
    await _rememberOffline(
      kind: 'staff',
      loginId: email.trim().toLowerCase(),
      secret: password,
      accessToken: token!,
      signedIn: signedIn,
    );
    await warmCache();
    return user!;
  }

  Future<StudentLookup> lookupStudent(String studentCode) async {
    final data = await _request(
      'POST',
      '/student-portal/lookup',
      body: {'studentCode': studentCode.trim()},
      auth: false,
    ) as Map<String, dynamic>;
    return StudentLookup(
      student: PortalStudent.fromJson(data),
      hasAccount: data['hasAccount'] == true,
    );
  }

  Future<PortalWallet> registerStudentPortal({
    required String studentCode,
    required String password,
  }) async {
    final data = await _request(
      'POST',
      '/student-portal/register',
      body: {'studentCode': studentCode.trim(), 'password': password},
      auth: false,
    ) as Map<String, dynamic>;
    final wallet = await _storePortalSession(data, 'student');
    await _rememberOffline(
      kind: 'student',
      loginId: _studentLoginId(studentCode),
      secret: password,
      accessToken: token!,
      signedPortal: wallet.student,
    );
    return wallet;
  }

  Future<PortalWallet> loginStudentPortal({
    required String studentCode,
    required String password,
  }) async {
    final loginId = _studentLoginId(studentCode);
    if (!await connectivity.checkOnline()) {
      await _restoreOffline(kind: 'student', loginId: loginId, secret: password);
      return PortalWallet(student: portal!, balanceRwf: 0, activity: const []);
    }
    try {
      final data = await _request(
        'POST',
        '/student-portal/login',
        body: {'studentCode': studentCode.trim(), 'password': password},
        auth: false,
      ) as Map<String, dynamic>;
      final wallet = await _storePortalSession(data, 'student');
      await _rememberOffline(
        kind: 'student',
        loginId: loginId,
        secret: password,
        accessToken: token!,
        signedPortal: wallet.student,
      );
      return wallet;
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _restoreOffline(kind: 'student', loginId: loginId, secret: password);
      return PortalWallet(student: portal!, balanceRwf: 0, activity: const []);
    }
  }

  Future<PortalWallet> studentWallet() async {
    final data = await _request('GET', '/student-portal/wallet') as Map<String, dynamic>;
    final wallet = PortalWallet.fromJson(data);
    await _rememberPortal(wallet.student);
    return wallet;
  }

  Future<PortalWallet> openParentSession(String studentCode) async {
    final loginId = _studentLoginId(studentCode);
    if (!await connectivity.checkOnline()) {
      await _restoreOffline(kind: 'parent', loginId: loginId, secret: loginId);
      return PortalWallet(student: portal!, balanceRwf: 0, activity: const []);
    }
    try {
      final data = await _request(
        'POST',
        '/parents/session',
        body: {'studentCode': studentCode.trim()},
        auth: false,
      ) as Map<String, dynamic>;
      final wallet = await _storePortalSession(data, 'parent');
      await _rememberOffline(
        kind: 'parent',
        loginId: loginId,
        secret: loginId,
        accessToken: token!,
        signedPortal: wallet.student,
      );
      return wallet;
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _restoreOffline(kind: 'parent', loginId: loginId, secret: loginId);
      return PortalWallet(student: portal!, balanceRwf: 0, activity: const []);
    }
  }

  Future<PortalWallet> parentWallet() async {
    final data = await _request('GET', '/parents/wallet') as Map<String, dynamic>;
    final wallet = PortalWallet.fromJson(data);
    await _rememberPortal(wallet.student);
    return wallet;
  }

  Future<TopUpState> parentTopUp({
    required int amountRwf,
    required String mobilePhone,
    required String idempotencyKey,
  }) async {
    final data = await _request(
      'POST',
      '/parents/top-up',
      body: {
        'amountRwf': amountRwf,
        'mobilePhone': mobilePhone.trim(),
        'idempotencyKey': idempotencyKey,
      },
    ) as Map<String, dynamic>;
    return TopUpState.fromJson(data);
  }

  Future<TopUpState> parentTopUpStatus(String requestId) async {
    final data = await _request('GET', '/parents/top-up/${Uri.encodeComponent(requestId)}')
        as Map<String, dynamic>;
    return TopUpState.fromJson(data);
  }

  Future<PortalWallet> _storePortalSession(Map<String, dynamic> data, String nextAudience) async {
    final student = PortalStudent.fromJson(data['student'] as Map<String, dynamic>);
    final wallet = data['wallet'] as Map<String, dynamic>?;
    token = data['accessToken'] as String;
    user = null;
    portal = student;
    audience = nextAudience;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token!);
    await prefs.setString(_audienceKey, nextAudience);
    await prefs.setString(_portalKey, jsonEncode(student.toJson()));
    await prefs.remove(_userKey);
    return PortalWallet(
      student: student,
      balanceRwf: wallet == null ? 0 : _asInt(wallet['balanceRwf']),
      activity: const [],
    );
  }

  Future<void> _rememberPortal(PortalStudent student) async {
    portal = student;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_portalKey, jsonEncode(student.toJson()));
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? 0;
  }

  Future<void> _persistStaff(String accessToken, AuthUser signedIn) async {
    token = accessToken;
    user = signedIn;
    portal = null;
    audience = 'staff';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token!);
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    await prefs.setString(_audienceKey, 'staff');
    await prefs.remove(_portalKey);
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    await _request(
      'POST',
      '/auth/password',
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
    final email = user?.email;
    if (email != null && token != null && user != null) {
      await _rememberOffline(
        kind: 'staff',
        loginId: email.trim().toLowerCase(),
        secret: newPassword,
        accessToken: token!,
        signedIn: user,
      );
    }
  }

  Future<AuthUser> changeEmail({required String email, required String password}) async {
    final data = await _request(
      'POST',
      '/auth/email',
      body: {'email': email, 'password': password},
    );
    final previousEmail = user?.email.trim().toLowerCase();
    user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    final nextEmail = user!.email.trim().toLowerCase();
    if (previousEmail != null && previousEmail != nextEmail) {
      await local.removeOfflineAccount('staff', previousEmail);
    }
    if (token != null) {
      await _rememberOffline(
        kind: 'staff',
        loginId: nextEmail,
        secret: password,
        accessToken: token!,
        signedIn: user,
      );
    }
    return user!;
  }

  Future<void> logout() async {
    token = null;
    user = null;
    portal = null;
    audience = 'staff';
    servingFromCache = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    await prefs.remove(_portalKey);
    await prefs.remove(_audienceKey);
    await _notifySyncState();
  }

  Future<void> _notifySyncState() async {
    pendingSyncCount = (await local.loadPending()).length;
    onSyncStateChanged?.call();
  }

  String _studentLoginId(String studentCode) => studentCode.trim().toUpperCase();

  Future<void> _rememberOffline({
    required String kind,
    required String loginId,
    required String secret,
    required String accessToken,
    AuthUser? signedIn,
    PortalStudent? signedPortal,
  }) async {
    final salt = await local.offlineSalt();
    await local.saveOfflineAccount({
      'kind': kind,
      'loginId': loginId,
      'secretHash': sha256.convert(utf8.encode('$salt|$kind|$loginId|$secret')).toString(),
      'token': accessToken,
      if (signedIn != null) 'user': signedIn.toJson(),
      if (signedPortal != null) 'portal': signedPortal.toJson(),
    });
  }

  Future<void> _restoreOffline({
    required String kind,
    required String loginId,
    required String secret,
  }) async {
    final row = await local.findOfflineAccount(kind, loginId);
    if (row == null || row['token'] is! String || (row['token'] as String).isEmpty) {
      throw ApiException(
        'Sign in once with internet on this phone. After that, you can sign in without internet.',
      );
    }
    final salt = await local.offlineSalt();
    final hash = sha256.convert(utf8.encode('$salt|$kind|$loginId|$secret')).toString();
    if (hash != row['secretHash']) {
      throw ApiException(
        kind == 'staff' ? 'Email or password is incorrect.' : 'Student ID or password is incorrect.',
      );
    }
    final accessToken = row['token'] as String;
    if (kind == 'staff') {
      final userJson = row['user'];
      if (userJson is! Map) {
        throw ApiException(
          'Sign in once with internet on this phone. After that, you can sign in without internet.',
        );
      }
      await _persistStaff(accessToken, AuthUser.fromJson(Map<String, dynamic>.from(userJson)));
    } else {
      final portalJson = row['portal'];
      if (portalJson is! Map) {
        throw ApiException(
          'Sign in once with internet on this phone. After that, you can sign in without internet.',
        );
      }
      token = accessToken;
      user = null;
      portal = PortalStudent.fromJson(Map<String, dynamic>.from(portalJson));
      audience = kind;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token!);
      await prefs.setString(_audienceKey, kind);
      await prefs.setString(_portalKey, jsonEncode(portal!.toJson()));
      await prefs.remove(_userKey);
    }
    await refreshSyncState();
  }

  bool _isConnectionFailure(Object error) {
    if (error is ApiException) {
      final message = error.message.toLowerCase();
      return message.contains('unable to connect') || message.contains('internet');
    }
    return false;
  }

  List<Student> _filterStudents(List<Map<String, dynamic>> raw, {String? query, String? status}) {
    var list = raw.map((e) => Student.fromJson(e)).toList();
    if (status != null && status.isNotEmpty) {
      list = list.where((s) => s.status == status).toList();
    }
    if (query != null && query.isNotEmpty) {
      final q = query.toLowerCase();
      list = list.where((s) {
        return s.studentCode.toLowerCase().contains(q) ||
            s.firstName.toLowerCase().contains(q) ||
            s.lastName.toLowerCase().contains(q) ||
            s.fullName.toLowerCase().contains(q);
      }).toList();
    }
    return list;
  }

  Future<void> refreshSyncState() => _notifySyncState();

  Future<void> warmCache() async {
    if (!await connectivity.checkOnline()) return;
    try {
      final allStudents = await _request('GET', '/students') as List<dynamic>;
      await local.saveStudentList(allStudents);
      await canteens();
      await fingerprintSync();
      await dashboard();
      await transactions();
      if (user?.isAdmin ?? false) {
        await schools();
      }
      await syncPending();
    } catch (_) {}
  }

  Future<int> syncPending() async {
    if (syncInProgress) return pendingSyncCount;
    if (!await connectivity.checkOnline()) {
      await _notifySyncState();
      return pendingSyncCount;
    }
    syncInProgress = true;
    onSyncStateChanged?.call();
    var synced = 0;
    try {
      final queue = await local.loadPending();
      for (final action in List<PendingAction>.from(queue)) {
        try {
          await _applyPending(action);
          await local.removePending(action.id);
          synced++;
        } catch (error) {
          if (_isConnectionFailure(error)) break;
          lastSyncMessage = error is ApiException ? error.message : '$error';
          break;
        }
      }
      if (synced > 0) {
        lastSyncMessage = synced == 1 ? '1 item synced with the server.' : '$synced items synced with the server.';
        await warmCache();
      }
    } finally {
      syncInProgress = false;
      await _notifySyncState();
    }
    return pendingSyncCount;
  }

  Future<void> _applyPending(PendingAction action) async {
    switch (action.type) {
      case 'purchase':
        await _request('POST', '/purchases', body: action.body);
        await local.removeLocalEvent(action.localEventId ?? '');
        return;
      case 'reverse':
        final eventId = action.body['eventId'] as String;
        await _request(
          'POST',
          '/purchases/$eventId/reverse',
          body: {'idempotencyKey': action.body['idempotencyKey'] ?? _uuid.v4()},
        );
        return;
      case 'testCredit':
        final studentId = action.body['studentId'] as String;
        await _request(
          'POST',
          '/wallets/student/$studentId/test-credit',
          body: action.body,
        );
        return;
      case 'enrollFingerprint':
        await _request('POST', '/fingerprints/enroll', body: action.body);
        return;
      case 'removeFingerprint':
        final id = action.body['id'] as String;
        await _request('DELETE', '/fingerprints/$id');
        return;
      case 'createStudent':
        await _request('POST', '/students', body: action.body);
        return;
      case 'updateStudent':
        final id = action.body['id'] as String;
        final payload = Map<String, dynamic>.from(action.body)..remove('id');
        await _request('PATCH', '/students/$id', body: payload);
        return;
      case 'deleteStudent':
        final id = action.body['id'] as String;
        await _request('DELETE', '/students/$id');
        return;
      case 'withdraw':
        final canteenId = action.body['canteenId'] as String;
        final payload = Map<String, dynamic>.from(action.body)..remove('canteenId');
        await _request('POST', '/canteens/$canteenId/withdraw', body: payload);
        return;
      default:
        throw ApiException('Unknown offline action ${action.type}');
    }
  }

  Future<DashboardStats> dashboard() async {
    servingFromCache = false;
    try {
      final data = await _request('GET', '/dashboard') as Map<String, dynamic>;
      await local.saveDashboard(data);
      final stats = DashboardStats.fromJson(data);
      return _mergeDashboardWithLocal(stats);
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadDashboard();
      if (cached == null) rethrow;
      servingFromCache = true;
      return _mergeDashboardWithLocal(DashboardStats.fromJson(cached));
    }
  }

  DashboardStats _mergeDashboardWithLocal(DashboardStats stats) {
    // Local pending purchases are surfaced via transactions(); dashboard stays server snapshot.
    return stats;
  }

  Future<List<School>> schools() async {
    servingFromCache = false;
    try {
      final data = await _request('GET', '/schools') as List<dynamic>;
      await local.saveSchools(data);
      return data.map((e) => School.fromJson(e as Map<String, dynamic>)).toList();
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadSchools();
      if (cached == null) rethrow;
      servingFromCache = true;
      return cached.map((e) => School.fromJson(e)).toList();
    }
  }

  Future<List<Student>> students({String? query, String? status}) async {
    servingFromCache = false;
    final params = <String, String>{};
    if (query != null && query.isNotEmpty) params['q'] = query;
    if (status != null) params['status'] = status;
    try {
      final data = await _request('GET', '/students', query: params.isEmpty ? null : params) as List<dynamic>;
      if (params.isEmpty) {
        await local.saveStudentList(data);
      } else {
        final existing = await local.loadStudentList();
        if (existing == null || existing.isEmpty) {
          await local.saveStudentList(data);
        }
      }
      return data.map((e) => Student.fromJson(e as Map<String, dynamic>)).toList();
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadStudentList();
      if (cached == null) rethrow;
      servingFromCache = true;
      return _filterStudents(cached, query: query, status: status);
    }
  }

  Future<Student> student(String id) async {
    servingFromCache = false;
    try {
      final data = await _request('GET', '/students/$id') as Map<String, dynamic>;
      return Student.fromJson(data);
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadStudentList();
      if (cached == null) rethrow;
      final row = cached.where((e) => e['id'] == id).firstOrNull;
      if (row == null) rethrow;
      servingFromCache = true;
      return Student.fromJson(row);
    }
  }

  Future<Student> createStudent(Map<String, dynamic> body) async {
    if (!await connectivity.checkOnline()) {
      return _queueStudentMutation('createStudent', body);
    }
    try {
      return Student.fromJson(await _request('POST', '/students', body: body));
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      return _queueStudentMutation('createStudent', body);
    }
  }

  Future<Student> updateStudent(String id, Map<String, dynamic> body) async {
    final payload = {...body, 'id': id};
    if (!await connectivity.checkOnline()) {
      return _queueStudentMutation('updateStudent', payload);
    }
    try {
      return Student.fromJson(await _request('PATCH', '/students/$id', body: body));
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      return _queueStudentMutation('updateStudent', payload);
    }
  }

  Future<Student> deactivateStudent(String id) async {
    return updateStudent(id, {'status': 'INACTIVE'});
  }

  Future<void> deleteStudent(String id) async {
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('deleteStudent', {'id': id});
      final rows = await local.loadStudentList();
      if (rows != null) {
        rows.removeWhere((e) => e['id'] == id);
        await local.saveStudentList(rows);
      }
      return;
    }
    try {
      await _request('DELETE', '/students/$id');
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('deleteStudent', {'id': id});
    }
  }

  Future<Student> _queueStudentMutation(String type, Map<String, dynamic> body) async {
    await _enqueueOnly(type, body);
    if (type == 'createStudent') {
      final tempId = _uuid.v4();
      final row = {
        ...body,
        'id': tempId,
        'status': body['status'] ?? 'ACTIVE',
        'pinEnabled': body['pinEnabled'] ?? false,
        'hasPin': false,
        'wallet': {'id': 'local-$tempId', 'balanceRwf': 0},
      };
      final rows = await local.loadStudentList() ?? [];
      rows.insert(0, row);
      await local.saveStudentList(rows);
      servingFromCache = true;
      return Student.fromJson(row);
    }
    if (type == 'updateStudent') {
      final id = body['id'] as String;
      final rows = await local.loadStudentList();
      if (rows != null) {
        final index = rows.indexWhere((e) => e['id'] == id);
        if (index >= 0) {
          rows[index] = {...rows[index], ...body}..remove('id');
          rows[index]['id'] = id;
          await local.saveStudentList(rows);
          servingFromCache = true;
          return Student.fromJson(rows[index]);
        }
      }
    }
    throw ApiException('Saved offline. It will sync when you are back online.');
  }

  Future<void> _enqueueOnly(String type, Map<String, dynamic> body) async {
    await local.enqueue(
      PendingAction(
        id: _uuid.v4(),
        type: type,
        body: body,
        createdAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
    await _notifySyncState();
  }

  Future<WalletDetail> wallet(String studentId) async {
    servingFromCache = false;
    try {
      return WalletDetail.fromJson(
        await _request('GET', '/wallets/student/$studentId'),
      );
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadStudentList();
      if (cached == null) rethrow;
      final row = cached.where((e) => e['id'] == studentId).firstOrNull;
      if (row == null) rethrow;
      servingFromCache = true;
      final student = Student.fromJson(row);
      final walletId = student.wallet?.id ?? 'local-$studentId';
      final balance = student.wallet?.balanceRwf ?? 0;
      final localEvents = await local.loadLocalEvents();
      final history = localEvents
          .where((e) => e['student']?['id'] == studentId)
          .map((e) => LedgerEvent.fromJson(e))
          .toList();
      return WalletDetail(id: walletId, balanceRwf: balance, student: student, history: history);
    }
  }

  Future<void> testCredit(String studentId, int amountRwf, String description) async {
    final body = {
      'amountRwf': amountRwf,
      'description': description,
      'idempotencyKey': _uuid.v4(),
      'studentId': studentId,
    };
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('testCredit', body);
      final rows = await local.loadStudentList();
      if (rows != null) {
        final row = rows.where((e) => e['id'] == studentId).firstOrNull;
        if (row != null) {
          final wallet = row['wallet'];
          final current = wallet is Map ? wallet['balanceRwf'] as int? ?? 0 : 0;
          await local.patchStudentBalance(studentId, current + amountRwf);
        }
      }
      return;
    }
    try {
      await _request(
        'POST',
        '/wallets/student/$studentId/test-credit',
        body: {
          'amountRwf': amountRwf,
          'description': description,
          'idempotencyKey': body['idempotencyKey'],
        },
      );
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('testCredit', body);
    }
  }

  Future<List<FingerprintRecord>> fingerprints({String? studentId}) async {
    final params = <String, String>{};
    if (studentId != null) params['studentId'] = studentId;
    final data = await _request('GET', '/fingerprints', query: params) as List<dynamic>;
    return data.map((e) => FingerprintRecord.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<FingerprintRecord> enrollFingerprint({
    required String studentId,
    required String template,
    required String finger,
    String deviceModel = 'Live20R',
  }) async {
    final body = {
      'studentId': studentId,
      'template': template,
      'finger': finger,
      'deviceModel': deviceModel,
    };
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('enrollFingerprint', body);
      return FingerprintRecord(
        id: 'local-${_uuid.v4()}',
        studentId: studentId,
        finger: finger,
        deviceModel: deviceModel,
      );
    }
    try {
      return FingerprintRecord.fromJson(
        await _request('POST', '/fingerprints/enroll', body: body),
      );
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('enrollFingerprint', body);
      return FingerprintRecord(
        id: 'local-${_uuid.v4()}',
        studentId: studentId,
        finger: finger,
        deviceModel: deviceModel,
      );
    }
  }

  Future<void> removeFingerprint(String id) async {
    if (id.startsWith('local-')) return;
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('removeFingerprint', {'id': id});
      return;
    }
    try {
      await _request('DELETE', '/fingerprints/$id');
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('removeFingerprint', {'id': id});
    }
  }

  Future<Map<String, String>> fingerprintSync() async {
    try {
      final data = await _request('GET', '/fingerprints/sync') as List<dynamic>;
      final map = <String, String>{};
      for (final row in data) {
        if (row is Map<String, dynamic>) {
          final userId = row['userId'] as String?;
          final template = row['template'] as String?;
          if (userId != null && template != null && template.isNotEmpty) {
            map[userId] = template;
          }
        }
      }
      await local.saveFingerprintTemplates(map);
      return map;
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadFingerprintTemplates();
      if (cached == null || cached.isEmpty) rethrow;
      servingFromCache = true;
      return cached;
    }
  }

  Future<List<Canteen>> canteens() async {
    servingFromCache = false;
    try {
      final data = await _request('GET', '/canteens') as List<dynamic>;
      await local.saveCanteens(data);
      return data.map((e) => Canteen.fromJson(e as Map<String, dynamic>)).toList();
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadCanteens();
      if (cached == null) rethrow;
      servingFromCache = true;
      return cached.map((e) => Canteen.fromJson(e)).toList();
    }
  }

  Future<Canteen> canteen(String id) async {
    servingFromCache = false;
    try {
      return Canteen.fromJson(await _request('GET', '/canteens/$id'));
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadCanteens();
      if (cached == null) rethrow;
      final row = cached.where((e) => e['id'] == id).firstOrNull;
      if (row == null) rethrow;
      servingFromCache = true;
      return Canteen.fromJson(row);
    }
  }

  Future<Canteen> createCanteen(String name, String schoolId) async {
    return Canteen.fromJson(
      await _request('POST', '/canteens', body: {'name': name, 'schoolId': schoolId}),
    );
  }

  Future<Map<String, dynamic>> withdrawCanteen({
    required String canteenId,
    required int amountRwf,
    required String mobilePhone,
  }) async {
    final body = {
      'canteenId': canteenId,
      'amountRwf': amountRwf,
      'mobilePhone': mobilePhone,
      'idempotencyKey': _uuid.v4(),
    };
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('withdraw', body);
      return {'ok': true, 'offline': true, 'message': 'Withdraw saved. It will send when you are online.'};
    }
    try {
      return Map<String, dynamic>.from(
        await _request(
          'POST',
          '/canteens/$canteenId/withdraw',
          body: {
            'amountRwf': amountRwf,
            'mobilePhone': mobilePhone,
            'idempotencyKey': body['idempotencyKey'],
          },
        ) as Map,
      );
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('withdraw', body);
      return {'ok': true, 'offline': true, 'message': 'Withdraw saved. It will send when you are online.'};
    }
  }

  Future<Map<String, dynamic>> platformWallet() async {
    return Map<String, dynamic>.from(await _request('GET', '/platform/wallet') as Map);
  }

  Future<Map<String, dynamic>> withdrawPlatform({
    required int amountRwf,
    required String mobilePhone,
  }) async {
    return Map<String, dynamic>.from(
      await _request(
        'POST',
        '/platform/withdraw',
        body: {
          'amountRwf': amountRwf,
          'mobilePhone': mobilePhone,
          'idempotencyKey': _uuid.v4(),
        },
      ) as Map,
    );
  }

  Future<PurchaseResult> purchase(Map<String, dynamic> body) async {
    final payload = {...body, 'idempotencyKey': body['idempotencyKey'] ?? _uuid.v4()};
    if (!await connectivity.checkOnline()) {
      return _purchaseOffline(payload);
    }
    try {
      final result = PurchaseResult.fromJson(
        await _request('POST', '/purchases', body: payload),
      );
      unawaited(syncPending());
      return result;
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      return _purchaseOffline(payload);
    }
  }

  Future<PurchaseResult> _purchaseOffline(Map<String, dynamic> body) async {
    final studentId = body['studentId'] as String?;
    final amountRwf = body['amountRwf'] as int?;
    if (studentId == null || amountRwf == null) {
      throw ApiException('Missing payment details.');
    }
    final students = await this.students(status: 'ACTIVE');
    final match = students.where((s) => s.id == studentId).firstOrNull;
    if (match == null) {
      throw ApiException('Student not found on this device. Open the app online once to download students.');
    }
    final balance = match.wallet?.balanceRwf ?? 0;
    if (balance < amountRwf) {
      throw ApiException('Not enough money on the wallet (${balance.toString()} RWF).');
    }
    final localEventId = 'local-${body['idempotencyKey']}';
    final canteenId = body['canteenId'] as String?;
    final canteens = await this.canteens();
    final canteenName = canteens.where((c) => c.id == canteenId).firstOrNull?.name;
    final now = DateTime.now().toUtc().toIso8601String();
    final eventJson = {
      'id': localEventId,
      'type': 'PURCHASE',
      'status': 'PENDING_SYNC',
      'amountRwf': amountRwf,
      'createdAt': now,
      'description': body['description'] ?? 'Canteen meal',
      'canteen': canteenName == null ? null : {'name': canteenName},
      'student': {
        'id': match.id,
        'studentCode': match.studentCode,
        'firstName': match.firstName,
        'lastName': match.lastName,
      },
    };
    await local.addLocalEvent(eventJson);
    await local.enqueue(
      PendingAction(
        id: _uuid.v4(),
        type: 'purchase',
        body: body,
        createdAt: now,
        localEventId: localEventId,
      ),
    );
    final newBalance = balance - amountRwf;
    await local.patchStudentBalance(studentId, newBalance);
    await _notifySyncState();
    servingFromCache = true;
    return PurchaseResult(
      event: LedgerEvent.fromJson(eventJson),
      wallet: WalletSummary(id: match.wallet?.id ?? 'local', balanceRwf: newBalance),
      duplicate: false,
    );
  }

  Future<List<LedgerEvent>> transactions({String? studentId, String? canteenId}) async {
    servingFromCache = false;
    final params = <String, String>{};
    if (studentId != null) params['studentId'] = studentId;
    if (canteenId != null) params['canteenId'] = canteenId;
    try {
      final data = await _request('GET', '/transactions', query: params.isEmpty ? null : params) as List<dynamic>;
      if (params.isEmpty) {
        await local.saveTransactions(data);
      }
      return await _mergeTransactions(data.map((e) => LedgerEvent.fromJson(e as Map<String, dynamic>)).toList());
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadTransactions();
      if (cached == null) {
        servingFromCache = true;
        return await _mergeTransactions(const []);
      }
      servingFromCache = true;
      return await _mergeTransactions(cached.map((e) => LedgerEvent.fromJson(e)).toList());
    }
  }

  Future<List<LedgerEvent>> _mergeTransactions(List<LedgerEvent> server) async {
    final rows = await local.loadLocalEvents();
    final localEvents = rows.map((e) => LedgerEvent.fromJson(e)).toList();
    final ids = server.map((e) => e.id).toSet();
    final merged = [...localEvents.where((e) => !ids.contains(e.id)), ...server];
    merged.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return merged;
  }

  Future<LedgerEvent> transaction(String id) async {
    if (id.startsWith('local-')) {
      final rows = await local.loadLocalEvents();
      final row = rows.where((e) => e['id'] == id).firstOrNull;
      if (row == null) throw ApiException('Transaction not found on this device.');
      servingFromCache = true;
      return LedgerEvent.fromJson(row);
    }
    try {
      return LedgerEvent.fromJson(await _request('GET', '/transactions/$id'));
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      final cached = await local.loadTransactions();
      final row = cached?.where((e) => e['id'] == id).firstOrNull;
      if (row == null) rethrow;
      servingFromCache = true;
      return LedgerEvent.fromJson(row);
    }
  }

  Future<void> reverse(String id) async {
    if (id.startsWith('local-')) {
      final pending = await local.loadPending();
      final action = pending.where((e) => e.localEventId == id).firstOrNull;
      if (action != null) {
        final studentId = action.body['studentId'] as String?;
        final amount = action.body['amountRwf'] as int?;
        await local.removePending(action.id);
        await local.removeLocalEvent(id);
        if (studentId != null && amount != null) {
          final rows = await local.loadStudentList();
          final row = rows?.where((e) => e['id'] == studentId).firstOrNull;
          final current = row?['wallet'] is Map ? row!['wallet']['balanceRwf'] as int? ?? 0 : 0;
          await local.patchStudentBalance(studentId, current + amount);
        }
        await _notifySyncState();
        return;
      }
      throw ApiException('This offline payment was already removed.');
    }
    final body = {'eventId': id, 'idempotencyKey': _uuid.v4()};
    if (!await connectivity.checkOnline()) {
      await _enqueueOnly('reverse', body);
      return;
    }
    try {
      await _request(
        'POST',
        '/purchases/$id/reverse',
        body: {'idempotencyKey': body['idempotencyKey']},
      );
    } catch (error) {
      if (!_isConnectionFailure(error)) rethrow;
      await _enqueueOnly('reverse', body);
    }
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth && token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    http.Response response;
    try {
      final encoded = body == null ? null : jsonEncode(body);
      const timeout = Duration(seconds: 12);
      response = switch (method) {
        'GET' => await http.get(uri, headers: headers).timeout(timeout),
        'POST' => await http.post(uri, headers: headers, body: encoded).timeout(timeout),
        'PATCH' => await http.patch(uri, headers: headers, body: encoded).timeout(timeout),
        'DELETE' => await http.delete(uri, headers: headers).timeout(timeout),
        _ => throw ApiException('Unsupported method $method'),
      };
    } catch (error) {
      if (error is ApiException) rethrow;
      throw ApiException(
        'Unable to connect right now. Check your internet and try again.',
      );
    }

    dynamic data;
    if (response.body.isNotEmpty) {
      data = jsonDecode(response.body);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (auth && response.statusCode == 401) {
        await logout();
        onAuthLost?.call();
        throw ApiException('Please sign in again.', 401);
      }
      var message = response.reasonPhrase ?? 'Request failed';
      if (data is Map && data['message'] != null) {
        final value = data['message'];
        message = value is List ? value.join(', ') : value.toString();
      }
      throw ApiException(message, response.statusCode);
    }
    return data;
  }
}
