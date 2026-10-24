import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class PcScannerClient {
  PcScannerClient(this.baseUrl);

  static const prefsKey = 'ekofi_scanner_url';
  static const port = 8787;

  final String baseUrl;

  Future<Map<String, dynamic>> _post(String path, [Map<String, dynamic>? body]) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl$path'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body ?? {}),
        )
        .timeout(const Duration(seconds: 50));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 || data['ok'] == false) {
      throw Exception(data['error'] ?? 'The computer fingerprint reader could not finish.');
    }
    return data;
  }

  Future<void> connect() async {
    final data = await _post('/connect');
    if (data['ok'] != true) {
      throw Exception(data['error'] ?? 'Could not open the computer fingerprint reader.');
    }
  }

  Future<String> enroll() async {
    final data = await _post('/enroll');
    final template = data['template'] as String? ?? '';
    if (template.length < 20) {
      throw Exception('The fingerprint was not clear enough. Lift the finger and try again.');
    }
    return template;
  }

  Future<String> identify(Map<String, String> templates) async {
    final data = await _post('/identify', {'templates': templates});
    final userId = data['userId'] as String? ?? '';
    if (userId.isEmpty) {
      throw Exception('No matching student. Register this fingerprint in the admin screen first.');
    }
    return userId;
  }

  Uint8List? imageFrom(Map<String, dynamic> data) {
    final raw = data['image'] as String?;
    if (raw == null || raw.isEmpty) return null;
    try {
      return base64Decode(raw);
    } catch (_) {
      return null;
    }
  }

  static Future<String?> savedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(prefsKey);
    if (saved == null || saved.trim().isEmpty) return null;
    return saved.trim().replaceAll(RegExp(r'/$'), '');
  }

  static Future<void> saveUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefsKey, url.trim().replaceAll(RegExp(r'/$'), ''));
  }

  static Future<String?> discover() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(prefsKey);
    final priority = <String>[
      if (saved != null && saved.trim().isNotEmpty) saved.trim().replaceAll(RegExp(r'/$'), ''),
      'http://127.0.0.1:$port',
      'http://192.168.1.112:$port',
    ];
    for (final url in priority) {
      if (await _healthy(url)) {
        await saveUrl(url);
        return url;
      }
    }

    final udp = await _listenUdp();
    if (udp != null && await _healthy(udp)) {
      await saveUrl(udp);
      return udp;
    }

    final found = await _scanSubnets();
    if (found != null) {
      await saveUrl(found);
    }
    return found;
  }

  static Future<String?> _scanSubnets() async {
    const prefixes = ['192.168.1.', '192.168.0.'];
    for (final prefix in prefixes) {
      for (var start = 1; start <= 254; start += 32) {
        final chunk = <Future<String?>>[];
        for (var i = start; i < start + 32 && i <= 254; i++) {
          final url = 'http://$prefix$i:$port';
          chunk.add(_healthy(url).then((ok) => ok ? url : null));
        }
        final results = await Future.wait(chunk);
        for (final url in results) {
          if (url != null) return url;
        }
      }
    }
    return null;
  }

  static Future<bool> _healthy(String url) async {
    try {
      final response = await http.get(Uri.parse('$url/health')).timeout(const Duration(milliseconds: 250));
      if (response.statusCode != 200) return false;
      final data = jsonDecode(response.body);
      return data is Map && data['service'] == 'ekofi-scanner';
    } catch (_) {
      return false;
    }
  }

  static Future<String?> _listenUdp() async {
    try {
      final socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 8788);
      socket.broadcastEnabled = true;
      final found = Completer<String?>();
      socket.listen((event) {
        if (event != RawSocketEvent.read || found.isCompleted) return;
        final packet = socket.receive();
        if (packet == null) return;
        final text = utf8.decode(packet.data, allowMalformed: true);
        final match = RegExp(r'http://[0-9.]+:8787').firstMatch(text);
        if (match != null) found.complete(match.group(0));
      });
      final result = await found.future.timeout(const Duration(seconds: 2), onTimeout: () => null);
      socket.close();
      return result;
    } catch (_) {
      return null;
    }
  }
}
