import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'welcome_screen.dart';

class PlatformScreen extends StatefulWidget {
  const PlatformScreen({super.key});

  @override
  State<PlatformScreen> createState() => _PlatformScreenState();
}

class _PlatformScreenState extends State<PlatformScreen> {
  final amount = TextEditingController();
  final phone = TextEditingController();
  int balance = 0;
  List<Map<String, dynamic>> fees = [];
  List<Map<String, dynamic>> withdrawals = [];
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    amount.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<SessionController>().api.platformWallet();
      balance = data['balanceRwf'] as int? ?? 0;
      fees = ((data['fees'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      withdrawals = ((data['withdrawals'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _send() async {
    final parsed = int.tryParse(amount.text.trim());
    if (parsed == null || parsed < 100) {
      showError(context, 'Enter at least 100 RWF.');
      return;
    }
    if (parsed > balance) {
      showError(context, 'That is more than the fee balance.');
      return;
    }
    if (phone.text.trim().length < 9) {
      showError(context, 'Enter the MTN or Airtel number that should receive the money.');
      return;
    }
    setState(() => saving = true);
    try {
      final result = await context.read<SessionController>().api.withdrawPlatform(
        amountRwf: parsed,
        mobilePhone: phone.text.trim(),
      );
      if (!mounted) return;
      await showPaymentBurst(
        context,
        ok: true,
        title: 'Withdrawal sent',
        message: 'Intouch is sending ${rwf(parsed)} to ${result['phone'] ?? phone.text}.',
      );
      amount.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        await showPaymentBurst(context, ok: false, title: 'Withdrawal failed', message: e.message);
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Service fees'),
        actions: [
          IconButton(
            onPressed: () async {
              await session.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const WelcomeScreen()),
                (_) => false,
              );
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: loading
          ? const LoadingView()
          : RefreshIndicator(
              color: teal,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (error != null) ErrorBanner(message: error!),
                  Text(
                    'Hello, ${firstNameOf(session.user?.name)}',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: navy),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'This is the 3% kept from parent top-ups. Only you can withdraw it.',
                    style: TextStyle(color: muted, fontSize: 16, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Fee balance', style: TextStyle(color: muted, fontSize: 16)),
                          const SizedBox(height: 6),
                          Text(rwf(balance), style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: navy)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text('Withdraw to my phone', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
                          const SizedBox(height: 12),
                          TextField(
                            controller: amount,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontSize: 20),
                            decoration: const InputDecoration(labelText: 'Amount (RWF)'),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: phone,
                            keyboardType: TextInputType.phone,
                            style: const TextStyle(fontSize: 20),
                            decoration: const InputDecoration(labelText: 'MTN or Airtel number'),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: saving ? null : _send,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              child: Text(saving ? 'Sending…' : 'Withdraw fees', style: const TextStyle(fontSize: 18)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Fees collected', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (fees.isEmpty)
                    const Text('No service fees yet.', style: TextStyle(color: muted, fontSize: 16))
                  else
                    ...fees.map(
                      (row) => Card(
                        child: ListTile(
                          title: Text('+ ${rwf(row['feeRwf'] as int? ?? 0)}', style: const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text('${row['studentCode'] ?? ''} · ${row['studentName'] ?? ''}'),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  const Text('Withdrawals', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (withdrawals.isEmpty)
                    const Text('No withdrawals yet.', style: TextStyle(color: muted, fontSize: 16))
                  else
                    ...withdrawals.map(
                      (row) => Card(
                        child: ListTile(
                          title: Text(rwf(row['amountRwf'] as int? ?? 0), style: const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text(row['description'] as String? ?? 'Sent to mobile money'),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
