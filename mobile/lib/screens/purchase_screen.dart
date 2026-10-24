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
  List<Student> students = [];
  List<Canteen> canteens = [];
  Map<String, String> templates = {};
  String? canteenId;
  bool loading = true;
  bool working = false;
  bool connected = false;
  String status = 'Enter the meal amount, then take the student’s fingerprint.';
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
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<SessionController>().api;
    try {
      students = await api.students(status: 'ACTIVE');
      canteens = await api.canteens();
      canteenId ??= canteens.firstOrNull?.id;
      try {
        templates = await api.fingerprintSync();
      } on ApiException catch (e) {
        if (e.statusCode != 401 && mounted) showError(context, e);
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  int? get parsedAmount => int.tryParse(amount.text.trim());

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
          status = 'Amount first. Then the student places a finger on the glass.';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        await showPaymentBurst(context, ok: false, title: 'Reader not ready', message: '$error');
      }
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Future<void> _payWithFingerprint() async {
    final meal = parsedAmount;
    if (meal == null || meal < 1) {
      await showPaymentBurst(
        context,
        ok: false,
        title: 'Amount needed',
        message: 'Enter the meal amount before the student uses the fingerprint reader.',
      );
      return;
    }
    if (canteenId == null) {
      await showPaymentBurst(context, ok: false, title: 'Choose a canteen', message: 'Pick the canteen taking this payment.');
      return;
    }
    if (!connected) {
      await _connect();
      if (!mounted || !connected) return;
    }
    setState(() {
      working = true;
      status = 'Student: place a finger on the glass.';
    });
    try {
      final api = context.read<SessionController>().api;
      templates = await api.fingerprintSync();
      if (!mounted) return;
      final identified = await scanner.identify(templates: templates);
      final matchedId = identified.split('::').first;
      if (!mounted) return;
      var match = students.where((s) => s.id == matchedId).firstOrNull;
      if (match == null) {
        students = await api.students(status: 'ACTIVE');
        match = students.where((s) => s.id == matchedId).firstOrNull;
      }
      if (match == null) {
        throw Exception('This fingerprint is not linked to an active student.');
      }
      setState(() => status = 'Recognised ${match!.studentCode} · ${match.fullName}. Taking payment…');
      final posted = await api.purchase({
        'amountRwf': meal,
        'canteenId': canteenId,
        'studentId': match.id,
        'description': 'Canteen meal',
        'identifiedBy': 'FINGERPRINT',
      });
      final remaining = posted.wallet != null ? rwf(posted.wallet!.balanceRwf) : '—';
      amount.clear();
      if (!mounted) return;
      await showPaymentBurst(
        context,
        ok: true,
        title: posted.duplicate ? 'Already taken' : 'Payment successful',
        message: posted.duplicate
            ? '${match.fullName} was already charged. Wallet still $remaining.'
            : '${match.studentCode} · ${match.fullName}\n${rwf(meal)} paid.\nWallet left $remaining.',
      );
      setState(() => status = 'Ready for the next meal. Enter the amount, then take a fingerprint.');
      await _load();
    } catch (error) {
      if (mounted) {
        setState(() => status = '$error');
        await showPaymentBurst(context, ok: false, title: 'Payment failed', message: '$error');
      }
    } finally {
      if (mounted) setState(() => working = false);
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
                          'Amount, then fingerprint',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: navy),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Type the meal amount first. The student’s fingerprint confirms who pays. No PIN is used.',
                          style: TextStyle(color: muted, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          height: 160,
                          decoration: BoxDecoration(
                            color: canvas.withValues(alpha: 0.7),
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
                  onChanged: working ? null : (value) => setState(() => canteenId = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  enabled: !working,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount the student will pay (RWF)'),
                ),
                const SizedBox(height: 20),
                if (!connected)
                  FilledButton.icon(
                    onPressed: working ? null : _connect,
                    icon: const Icon(Icons.usb),
                    label: Text(working ? 'Connecting…' : 'Connect reader'),
                  ),
                if (connected)
                  FilledButton.icon(
                    onPressed: working ? null : _payWithFingerprint,
                    icon: const Icon(Icons.fingerprint),
                    label: Text(working ? 'Waiting for fingerprint…' : 'Take fingerprint and pay'),
                  ),
              ],
            ),
    );
  }
}
