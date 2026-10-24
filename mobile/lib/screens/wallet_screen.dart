import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  WalletDetail? wallet;
  String? error;
  final amount = TextEditingController();
  final description = TextEditingController(text: 'Wallet top-up');
  bool saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    amount.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      wallet = await context.read<SessionController>().api.wallet(widget.studentId);
      error = null;
    } on ApiException catch (e) {
      error = e.message;
    }
    if (mounted) setState(() {});
  }

  Future<void> _credit() async {
    setState(() => saving = true);
    try {
      await context.read<SessionController>().api.testCredit(
        widget.studentId,
        int.parse(amount.text),
        description.text,
      );
      amount.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    final wallet = this.wallet;
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: wallet == null
          ? Center(child: error != null ? ErrorBanner(message: error!) : const LoadingView())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(wallet.student.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                        Text(wallet.student.studentCode, style: const TextStyle(color: muted)),
                        const SizedBox(height: 12),
                        const Text('Available', style: TextStyle(color: muted)),
                        Text(
                          rwf(wallet.balanceRwf),
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: navy, letterSpacing: -0.8),
                        ),
                      ],
                    ),
                  ),
                ),
                if (admin) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Add money for meals. This is recorded in the student’s wallet history.',
                    style: TextStyle(color: muted, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount (RWF)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: description,
                    decoration: const InputDecoration(labelText: 'Note'),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: saving ? null : _credit,
                    child: Text(saving ? 'Adding money…' : 'Add money'),
                  ),
                ],
                const SizedBox(height: 24),
                const Text('History', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: navy)),
                const SizedBox(height: 8),
                if (wallet.history.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'No activity yet',
                    message: 'Meals and top-ups will show here.',
                  )
                else
                  ...wallet.history.map(
                    (event) => Card(
                      child: ListTile(
                        title: Text(friendlyEvent(event.type), style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(friendlyStatus(event.status), style: const TextStyle(color: muted)),
                        trailing: Text(rwf(event.amountRwf), style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
