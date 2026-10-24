import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key});

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final amount = TextEditingController();
  final phone = TextEditingController();
  List<Canteen> canteens = [];
  String? canteenId;
  bool loading = true;
  bool saving = false;

  Canteen? get selected => canteens.where((c) => c.id == canteenId).firstOrNull;

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
    try {
      canteens = await context.read<SessionController>().api.canteens();
      canteenId ??= canteens.firstOrNull?.id;
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _send() async {
    final parsed = int.tryParse(amount.text.trim());
    if (canteenId == null) {
      showError(context, 'Choose a canteen first.');
      return;
    }
    if (parsed == null || parsed < 100) {
      showError(context, 'Enter at least 100 RWF.');
      return;
    }
    if (phone.text.trim().length < 9) {
      showError(context, 'Enter the MTN or Airtel number that should receive the money.');
      return;
    }
    setState(() => saving = true);
    try {
      final result = await context.read<SessionController>().api.withdrawCanteen(
        canteenId: canteenId!,
        amountRwf: parsed,
        mobilePhone: phone.text.trim(),
      );
      if (!mounted) return;
      await showPaymentBurst(
        context,
        ok: true,
        title: 'Withdrawal sent',
        message: 'Intouch Pay is sending ${rwf(parsed)} to ${result['phone'] ?? phone.text}.',
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
    return Scaffold(
      appBar: AppBar(title: const Text('Withdraw')),
      body: loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Canteen balance', style: TextStyle(color: muted, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(
                          selected?.account != null ? rwf(selected!.account!.balanceRwf) : '—',
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: navy),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Send canteen money to MTN or Airtel through Intouch Pay.',
                          style: TextStyle(color: muted, height: 1.4),
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
                  onChanged: (value) => setState(() => canteenId = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount (RWF)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Intouch number (MTN or Airtel)'),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: saving ? null : _send,
                  child: Text(saving ? 'Sending with Intouch…' : 'Withdraw with Intouch'),
                ),
              ],
            ),
    );
  }
}
