import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient();

  static const _tokenKey = 'ekofi_token';
  static const _userKey = 'ekofi_user';
  static const _urlKey = 'ekofi_api_url';
  static const _scannerKey = 'ekofi_scanner_url';

  final _uuid = const Uuid();

  String baseUrl = defaultApiUrl();
  String scannerUrl = '';
  String? token;
  AuthUser? user;
  void Function()? onAuthLost;

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
    final data = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      auth: false,
    );
    token = data['accessToken'] as String;
    user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token!);
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    return user!;
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
    token = data['accessToken'] as String;
    user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token!);
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    return user!;
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    return _request(
      'POST',
      '/auth/password',
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  Future<AuthUser> changeEmail({required String email, required String password}) async {
    final data = await _request(
      'POST',
      '/auth/email',
      body: {'email': email, 'password': password},
    );
    user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    return user!;
  }

  Future<void> logout() async {
    token = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  Future<DashboardStats> dashboard() async {
    return DashboardStats.fromJson(await _request('GET', '/dashboard'));
  }

  Future<List<School>> schools() async {
    final data = await _request('GET', '/schools') as List<dynamic>;
    return data.map((e) => School.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Student>> students({String? query, String? status}) async {
    final params = <String, String>{};
    if (query != null && query.isNotEmpty) params['q'] = query;
    if (status != null) params['status'] = status;
    final data = await _request('GET', '/students', query: params) as List<dynamic>;
    return data.map((e) => Student.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Student> student(String id) async {
    return Student.fromJson(await _request('GET', '/students/$id'));
  }

  Future<Student> createStudent(Map<String, dynamic> body) async {
    return Student.fromJson(await _request('POST', '/students', body: body));
  }

  Future<Student> updateStudent(String id, Map<String, dynamic> body) async {
    return Student.fromJson(await _request('PATCH', '/students/$id', body: body));
  }

  Future<Student> deactivateStudent(String id) async {
    return Student.fromJson(await _request('POST', '/students/$id/deactivate'));
  }

  Future<void> deleteStudent(String id) {
    return _request('DELETE', '/students/$id');
  }

  Future<WalletDetail> wallet(String studentId) async {
    return WalletDetail.fromJson(
      await _request('GET', '/wallets/student/$studentId'),
    );
  }

  Future<void> testCredit(String studentId, int amountRwf, String description) {
    return _request(
      'POST',
      '/wallets/student/$studentId/test-credit',
      body: {
        'amountRwf': amountRwf,
        'description': description,
        'idempotencyKey': _uuid.v4(),
      },
    );
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
    return FingerprintRecord.fromJson(
      await _request(
        'POST',
        '/fingerprints/enroll',
        body: {
          'studentId': studentId,
          'template': template,
          'finger': finger,
          'deviceModel': deviceModel,
        },
      ),
    );
  }

  Future<void> removeFingerprint(String id) {
    return _request('DELETE', '/fingerprints/$id');
  }

  Future<Map<String, String>> fingerprintSync() async {
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
    return map;
  }

  Future<List<NfcCard>> cards() async {
    final data = await _request('GET', '/cards') as List<dynamic>;
    return data.map((e) => NfcCard.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CardRegisterResult> registerCard({
    required String studentId,
    required String cardUid,
    String? authToken,
  }) async {
    return CardRegisterResult.fromJson(
      await _request(
        'POST',
        '/cards/register',
        body: {
          'studentId': studentId,
          'cardUid': cardUid,
          if (authToken != null && authToken.isNotEmpty) 'authToken': authToken,
        },
      ),
    );
  }

  Future<NfcCard> resolveCard(String cardUid, String authToken) async {
    return NfcCard.fromJson(
      await _request(
        'POST',
        '/cards/resolve',
        body: {'cardUid': cardUid, 'authToken': authToken},
      ),
    );
  }

  Future<void> blockCard(String id, String reason) {
    return _request('POST', '/cards/$id/block', body: {'reason': reason});
  }

  Future<CardRegisterResult> replaceCard({
    required String cardId,
    required String studentId,
    required String cardUid,
    String? authToken,
  }) async {
    return CardRegisterResult.fromJson(
      await _request(
        'POST',
        '/cards/$cardId/replace',
        body: {
          'studentId': studentId,
          'cardUid': cardUid,
          if (authToken != null && authToken.isNotEmpty) 'authToken': authToken,
        },
      ),
    );
  }

  Future<List<Canteen>> canteens() async {
    final data = await _request('GET', '/canteens') as List<dynamic>;
    return data.map((e) => Canteen.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Canteen> canteen(String id) async {
    return Canteen.fromJson(await _request('GET', '/canteens/$id'));
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
    return Map<String, dynamic>.from(
      await _request(
        'POST',
        '/canteens/$canteenId/withdraw',
        body: {
          'amountRwf': amountRwf,
          'mobilePhone': mobilePhone,
          'idempotencyKey': _uuid.v4(),
        },
      ) as Map,
    );
  }

  Future<PurchaseResult> purchase(Map<String, dynamic> body) async {
    return PurchaseResult.fromJson(
      await _request(
        'POST',
        '/purchases',
        body: {...body, 'idempotencyKey': body['idempotencyKey'] ?? _uuid.v4()},
      ),
    );
  }

  Future<List<LedgerEvent>> transactions({String? studentId, String? canteenId}) async {
    final params = <String, String>{};
    if (studentId != null) params['studentId'] = studentId;
    if (canteenId != null) params['canteenId'] = canteenId;
    final data = await _request('GET', '/transactions', query: params) as List<dynamic>;
    return data.map((e) => LedgerEvent.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<LedgerEvent> transaction(String id) async {
    return LedgerEvent.fromJson(await _request('GET', '/transactions/$id'));
  }

  Future<void> reverse(String id) {
    return _request(
      'POST',
      '/purchases/$id/reverse',
      body: {'idempotencyKey': _uuid.v4()},
    );
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
