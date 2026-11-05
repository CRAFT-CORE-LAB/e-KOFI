import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class PendingAction {
  PendingAction({
    required this.id,
    required this.type,
    required this.body,
    required this.createdAt,
    this.localEventId,
  });

  final String id;
  final String type;
  final Map<String, dynamic> body;
  final String createdAt;
  final String? localEventId;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'body': body,
    'createdAt': createdAt,
    if (localEventId != null) 'localEventId': localEventId,
  };

  factory PendingAction.fromJson(Map<String, dynamic> json) => PendingAction(
    id: json['id'] as String,
    type: json['type'] as String,
    body: Map<String, dynamic>.from(json['body'] as Map),
    createdAt: json['createdAt'] as String,
    localEventId: json['localEventId'] as String?,
  );
}

class LocalStore {
  static const _studentsKey = 'ekofi_cache_students';
  static const _canteensKey = 'ekofi_cache_canteens';
  static const _schoolsKey = 'ekofi_cache_schools';
  static const _templatesKey = 'ekofi_cache_fp_templates';
  static const _dashboardKey = 'ekofi_cache_dashboard';
  static const _transactionsKey = 'ekofi_cache_transactions';
  static const _pendingKey = 'ekofi_sync_pending';
  static const _localEventsKey = 'ekofi_local_ledger_events';
  static const _offlineAccountsKey = 'ekofi_offline_accounts';
  static const _offlineSaltKey = 'ekofi_offline_salt';

  Future<void> saveStudentList(List<dynamic> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_studentsKey, jsonEncode(rows));
  }

  Future<List<Map<String, dynamic>>?> loadStudentList() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_studentsKey);
    if (raw == null) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return null;
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> saveCanteens(List<dynamic> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_canteensKey, jsonEncode(rows));
  }

  Future<List<Map<String, dynamic>>?> loadCanteens() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_canteensKey);
    if (raw == null) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return null;
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> saveSchools(List<dynamic> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_schoolsKey, jsonEncode(rows));
  }

  Future<List<Map<String, dynamic>>?> loadSchools() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_schoolsKey);
    if (raw == null) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return null;
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> saveFingerprintTemplates(Map<String, String> templates) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_templatesKey, jsonEncode(templates));
  }

  Future<Map<String, String>?> loadFingerprintTemplates() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_templatesKey);
    if (raw == null) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    return decoded.map((key, value) => MapEntry(key.toString(), value.toString()));
  }

  Future<void> saveDashboard(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dashboardKey, jsonEncode(data));
  }

  Future<Map<String, dynamic>?> loadDashboard() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_dashboardKey);
    if (raw == null) return null;
    return Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  Future<void> saveTransactions(List<dynamic> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_transactionsKey, jsonEncode(rows));
  }

  Future<List<Map<String, dynamic>>?> loadTransactions() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_transactionsKey);
    if (raw == null) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! List) return null;
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<List<PendingAction>> loadPending() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded.map((e) => PendingAction.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> savePending(List<PendingAction> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pendingKey, jsonEncode(items.map((e) => e.toJson()).toList()));
  }

  Future<void> enqueue(PendingAction action) async {
    final items = await loadPending();
    items.add(action);
    await savePending(items);
  }

  Future<void> removePending(String id) async {
    final items = await loadPending();
    items.removeWhere((e) => e.id == id);
    await savePending(items);
  }

  Future<List<Map<String, dynamic>>> loadLocalEvents() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_localEventsKey);
    if (raw == null) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> saveLocalEvents(List<Map<String, dynamic>> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localEventsKey, jsonEncode(rows));
  }

  Future<void> addLocalEvent(Map<String, dynamic> event) async {
    final rows = await loadLocalEvents();
    rows.insert(0, event);
    await saveLocalEvents(rows);
  }

  Future<void> removeLocalEvent(String id) async {
    final rows = await loadLocalEvents();
    rows.removeWhere((e) => e['id'] == id);
    await saveLocalEvents(rows);
  }

  Future<void> patchStudentBalance(String studentId, int balanceRwf) async {
    final rows = await loadStudentList();
    if (rows == null) return;
    for (final row in rows) {
      if (row['id'] == studentId) {
        final wallet = row['wallet'];
        if (wallet is Map<String, dynamic>) {
          wallet['balanceRwf'] = balanceRwf;
        } else {
          row['wallet'] = {'id': 'local', 'balanceRwf': balanceRwf};
        }
        break;
      }
    }
    await saveStudentList(rows);
  }

  Future<String> offlineSalt() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_offlineSaltKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final random = Random.secure();
    final salt = List<int>.generate(16, (_) => random.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    await prefs.setString(_offlineSaltKey, salt);
    return salt;
  }

  Future<List<Map<String, dynamic>>> loadOfflineAccounts() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_offlineAccountsKey);
    if (raw == null) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> saveOfflineAccount(Map<String, dynamic> account) async {
    final accounts = await loadOfflineAccounts();
    accounts.removeWhere((e) => e['kind'] == account['kind'] && e['loginId'] == account['loginId']);
    accounts.add(account);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_offlineAccountsKey, jsonEncode(accounts));
  }

  Future<Map<String, dynamic>?> findOfflineAccount(String kind, String loginId) async {
    final accounts = await loadOfflineAccounts();
    for (final row in accounts) {
      if (row['kind'] == kind && row['loginId'] == loginId) return row;
    }
    return null;
  }

  Future<void> removeOfflineAccount(String kind, String loginId) async {
    final accounts = await loadOfflineAccounts();
    accounts.removeWhere((e) => e['kind'] == kind && e['loginId'] == loginId);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_offlineAccountsKey, jsonEncode(accounts));
  }

  Future<void> clearAllCaches() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_studentsKey);
    await prefs.remove(_canteensKey);
    await prefs.remove(_schoolsKey);
    await prefs.remove(_templatesKey);
    await prefs.remove(_dashboardKey);
    await prefs.remove(_transactionsKey);
    await prefs.remove(_pendingKey);
    await prefs.remove(_localEventsKey);
  }
}
