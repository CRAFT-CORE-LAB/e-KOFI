import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../fingerprint/live20r_scanner.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key});

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  final scanner = Live20RScanner();
  final amount = TextEditingController();
  final pin = TextEditingController();
  List<Student> students = [];
  List<Canteen> canteens = [];
  Map<String, String> templates = {};
  String? studentId;
  String? canteenId;
  bool loading = true;
  bool saving = false;
  bool scanning = false;
  bool connected = false;
  String status = 'Plug the Live20R into this phone, then tap Connect reader.';
  String? result;
  Uint8List? preview;
  StreamSubscription<String>? statusSub;
  StreamSubscription<Uint8List>? imageSub;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    statusSub?.cancel();
    imageSub?.cancel();
    scanner.disconnect();
    amount.dispose();
    pin.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<SessionController>().api;
    try {
      students = await api.students(status: 'ACTIVE');
      canteens = await api.canteens();
      templates = await api.fingerprintSync();
      canteenId ??= canteens.firstOrNull?.id;
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Student? get selected =>
      students.where((s) => s.id == studentId).firstOrNull;

  Future<void> _connect() async {
    setState(() {
      scanning = true;
      status = 'Looking for the Live20R reader…';
    });
    try {
      await scanner.connect();
      await statusSub?.cancel();
      await imageSub?.cancel();
      statusSub = scanner.status.listen((message) {
        if (mounted) setState(() => status = message);
      });
      imageSub = scanner.images.listen((bytes) {
        if (mounted) setState(() => preview = bytes);
      });
      if (mounted) {
        setState(() {
          connected = true;
          status = 'Reader is ready. Ask the student to place a finger on the glass.';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        showError(context, error);
      }
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> _scan() async {
    setState(() {
      scanning = true;
      result = null;
      status = 'Place a finger on the reader…';
    });
    try {
      templates = await context.read<SessionController>().api.fingerprintSync();
      final identified = await scanner.identify(templates: templates);
      final matchedId = identified.split('::').first;
      if (!mounted) return;
      var match = students.where((s) => s.id == matchedId).firstOrNull;
      if (match == null) {
        students = await context.read<SessionController>().api.students(status: 'ACTIVE');
        match = students.where((s) => s.id == matchedId).firstOrNull;
      }
      if (match == null) {
        throw Exception('This fingerprint is not linked to an active student.');
      }
      setState(() {
        studentId = match!.id;
        status = 'Recognised ${match.fullName}. Enter the meal amount.';
      });
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        showError(context, error);
      }
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> _pay() async {
    if (studentId == null) {
      showError(context, 'Identify the student with a fingerprint first.');
      return;
    }
    if (canteenId == null) {
      showError(context, 'Choose a canteen first.');
      return;
    }
    final parsed = int.tryParse(amount.text.trim());
    if (parsed == null || parsed < 1) {
      showError(context, 'Enter a valid meal amount.');
      return;
    }
    setState(() => saving = true);
    try {
      final posted = await context.read<SessionController>().api.purchase({
        'amountRwf': parsed,
        'canteenId': canteenId,
        'studentId': studentId,
        if (pin.text.isNotEmpty) 'pin': pin.text,
        'description': 'Canteen meal',
        'identifiedBy': 'FINGERPRINT',
      });
      setState(() {
        final remaining = posted.wallet != null ? rwf(posted.wallet!.balanceRwf) : '—';
        result = posted.duplicate
            ? 'This payment was already taken. Wallet still $remaining.'
            : 'Payment complete. Remaining $remaining.';
        studentId = null;
        status = 'Ready for the next student. Place a finger on the reader.';
      });
      amount.clear();
      pin.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Take payment')),
      body: loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Pay by fingerprint',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: navy),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Plug the Live20R into this phone. The student places a finger on the glass — no card is needed.',
                          style: TextStyle(color: muted, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          height: 160,
                          decoration: BoxDecoration(
                            color: canvas,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          alignment: Alignment.center,
                          child: preview == null
                              ? const Icon(Icons.fingerprint, size: 72, color: teal)
                              : ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.memory(preview!, fit: BoxFit.contain, height: 160),
                                ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          status,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: navy, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        if (!connected)
                          FilledButton.icon(
                            onPressed: scanning ? null : _connect,
                            icon: const Icon(Icons.usb),
                            label: Text(scanning ? 'Connecting…' : 'Connect reader'),
                          )
                        else
                          FilledButton.icon(
                            onPressed: scanning ? null : _scan,
                            icon: const Icon(Icons.fingerprint),
                            label: Text(scanning ? 'Waiting for fingerprint…' : 'Identify student'),
                          ),
                        if (selected != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Paying for ${selected!.fullName}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: navy),
                          ),
                          Text(
                            'Available ${selected!.wallet != null ? rwf(selected!.wallet!.balanceRwf) : '—'}'
                            '${selected!.pinEnabled ? ' · PIN needed' : ''}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: muted),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: canteenId,
                  decoration: const InputDecoration(labelText: 'Canteen'),
                  items: canteens
                      .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                      .toList(),
                  onChanged: (value) => setState(() => canteenId = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount (RWF)'),
                ),
                if (selected?.pinEnabled == true) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: pin,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Student PIN'),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: saving ? null : _pay,
                  child: Text(saving ? 'Taking payment…' : 'Confirm payment'),
                ),
                if (result != null) ...[
                  const SizedBox(height: 16),
                  Card(
                    color: teal.withValues(alpha: 0.12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(result!, style: const TextStyle(color: navy, height: 1.4)),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
