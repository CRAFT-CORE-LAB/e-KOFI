import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../fingerprint/live20r_scanner.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class FingerprintEnrollScreen extends StatefulWidget {
  const FingerprintEnrollScreen({
    super.key,
    required this.studentId,
    required this.studentName,
  });

  final String studentId;
  final String studentName;

  @override
  State<FingerprintEnrollScreen> createState() => _FingerprintEnrollScreenState();
}

class _FingerprintEnrollScreenState extends State<FingerprintEnrollScreen> {
  final scanner = Live20RScanner();
  String finger = 'RIGHT_INDEX';
  String status = 'Plug the reader into this phone or the computer, then tap Connect.';
  bool connected = false;
  bool working = false;
  Uint8List? preview;
  StreamSubscription<String>? statusSub;
  StreamSubscription<Uint8List>? imageSub;

  static const fingers = <String, String>{
    'RIGHT_THUMB': 'Right thumb',
    'RIGHT_INDEX': 'Right index',
    'LEFT_THUMB': 'Left thumb',
    'LEFT_INDEX': 'Left index',
  };

  @override
  void dispose() {
    statusSub?.cancel();
    imageSub?.cancel();
    scanner.disconnect();
    super.dispose();
  }

  Future<void> _connect() async {
    setState(() {
      working = true;
      status = 'Looking for the Live20R reader…';
    });
    try {
      await statusSub?.cancel();
      await imageSub?.cancel();
      statusSub = scanner.status.listen((message) {
        if (mounted) setState(() => status = message);
      });
      imageSub = scanner.images.listen((bytes) {
        if (mounted) setState(() => preview = bytes);
      });
      await scanner.connect();
      if (mounted) {
        setState(() {
          connected = true;
          status = scanner.onPhone
              ? 'Phone reader is ready. Ask the student to place a finger on the glass.'
              : 'Computer reader is ready. Ask the student to place a finger on the glass.';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        showError(context, error);
      }
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Future<void> _capture() async {
    setState(() {
      working = true;
      status = 'Place the same finger on the reader when asked. Usually three times.';
    });
    try {
      final template = await scanner.enroll(studentId: widget.studentId);
      if (!mounted) return;
      await context.read<SessionController>().api.enrollFingerprint(
        studentId: widget.studentId,
        template: template,
        finger: finger,
      );
      if (!mounted) return;
      await showInfo(
        context,
        'Fingerprint saved',
        '${widget.studentName} can now be recognised by fingerprint.',
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        showError(context, error);
      }
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register fingerprint')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(
            widget.studentName,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: navy),
          ),
          const SizedBox(height: 6),
          const Text(
            'Plug the Live20R into this phone with a USB OTG adapter, or into the computer on the same Wi-Fi. Then capture one finger.',
            style: TextStyle(color: muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Container(
                    height: 180,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: canvas,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: preview == null
                        ? const Icon(Icons.fingerprint, size: 72, color: teal)
                        : ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.memory(preview!, fit: BoxFit.contain, height: 180),
                          ),
                  ),
                  const SizedBox(height: 14),
                  Text(status, textAlign: TextAlign.center, style: const TextStyle(color: navy, height: 1.4)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: finger,
            decoration: const InputDecoration(labelText: 'Which finger'),
            items: fingers.entries
                .map((entry) => DropdownMenuItem(value: entry.key, child: Text(entry.value)))
                .toList(),
            onChanged: working ? null : (value) => setState(() => finger = value ?? finger),
          ),
          const SizedBox(height: 16),
          if (!connected)
            FilledButton(
              onPressed: working ? null : _connect,
              child: Text(working ? 'Connecting…' : 'Connect reader'),
            )
          else
            FilledButton(
              onPressed: working ? null : _capture,
              child: Text(working ? 'Reading fingerprint…' : 'Capture fingerprint'),
            ),
        ],
      ),
    );
  }
}
