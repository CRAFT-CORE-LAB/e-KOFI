import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'welcome_screen.dart';

const _amounts = [1000, 2000, 5000, 10000, 20000];

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  final phone = TextEditingController();
  final customAmount = TextEditingController(text: '5000');
  PortalWallet? wallet;
  int amount = 5000;
  bool loading = true;
  bool paying = false;
  String? message;
  String? error;
  int _poll = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll++;
    phone.dispose();
    customAmount.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = wallet == null;
      error = null;
    });
    try {
      final data = await context.read<SessionController>().api.parentWallet();
      if (!mounted) return;
      setState(() {
        wallet = data;
        loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = e.message;
      });
    }
  }

  Future<void> _topUp() async {
    final typed = int.tryParse(customAmount.text.replaceAll(',', '').trim());
    final gross = typed ?? amount;
    if (gross < 500 || gross > 500000) {
      setState(() => error = 'Enter an amount from 500 to 500,000 RWF.');
      return;
    }
    if (phone.text.trim().length < 9) {
      setState(() => error = 'Enter your MTN or Airtel number.');
      return;
    }
    final poll = ++_poll;
    setState(() {
      paying = true;
      error = null;
      message = 'Approve the message on your phone. This screen will update when the payment is finished.';
      amount = gross;
    });
    try {
      var result = await context.read<SessionController>().api.parentTopUp(
        amountRwf: gross,
        mobilePhone: phone.text.trim(),
        idempotencyKey: const Uuid().v4(),
      );
      final started = DateTime.now();
      while (result.isPending && DateTime.now().difference(started) < const Duration(seconds: 120)) {
        await Future<void>.delayed(const Duration(seconds: 3));
        if (!mounted || poll != _poll) return;
        result = await context.read<SessionController>().api.parentTopUpStatus(result.requestId);
      }
      if (!mounted || poll != _poll) return;
      if (result.isPending) {
        setState(() {
          message = 'Still waiting for approval on your phone. You can leave and come back.';
        });
        return;
      }
      if (result.isFailed) {
        setState(() {
          message = null;
          error = result.message.isEmpty ? 'The payment was not approved.' : result.message;
        });
        return;
      }
      final fresh = await context.read<SessionController>().api.parentWallet();
      if (!mounted || poll != _poll) return;
      final name = fresh.student.fullName;
      setState(() {
        wallet = fresh;
        message =
            '${rwf(result.studentCreditRwf)} is now on $name\'s wallet. Service fee ${rwf(result.feeRwf)}.';
      });
    } on ApiException catch (e) {
      if (!mounted || poll != _poll) return;
      setState(() {
        message = null;
        error = e.message;
      });
    } finally {
      if (mounted && poll == _poll) setState(() => paying = false);
    }
  }

  Future<void> _signOut() async {
    _poll++;
    final session = context.read<SessionController>();
    await session.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final student = wallet?.student ?? context.watch<SessionController>().portal;
    final activity = wallet?.activity ?? const <PortalActivity>[];
    final topUps = activity.where((row) => row.type == 'PARENT_TOPUP' || row.type == 'TEST_CREDIT').toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Parent wallet'),
        actions: [
          TextButton(onPressed: paying ? null : _signOut, child: const Text('Sign out')),
        ],
      ),
      body: loading
          ? const LoadingView()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
                children: [
                  Text(
                    student?.fullName ?? 'Your child',
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: navy, height: 1.15),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'ID ${student?.studentCode ?? ''}  ·  ${student?.className ?? ''}',
                    style: const TextStyle(fontSize: 18, color: navy, height: 1.35),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    student?.schoolName ?? '',
                    style: const TextStyle(fontSize: 18, color: muted, height: 1.35),
                  ),
                  if (student != null && !student.isActive) ...[
                    const SizedBox(height: 8),
                    Text(
                      friendlyStatus(student.status),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFFB42318)),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Money available for meals', style: TextStyle(fontSize: 16, color: muted)),
                          const SizedBox(height: 6),
                          Text(
                            rwf(wallet?.balanceRwf ?? 0),
                            style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: navy),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (message != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: teal.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(message!, style: const TextStyle(fontSize: 16, height: 1.4, color: navy)),
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 14),
                    ErrorBanner(message: error!),
                  ],
                  const SizedBox(height: 18),
                  const Text('Add money', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 6),
                  const Text(
                    'Pick an amount, enter your MTN or Airtel number, and approve the payment on your phone.',
                    style: TextStyle(fontSize: 16, height: 1.4, color: muted),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final value in _amounts)
                        ChoiceChip(
                          label: Text(rwf(value), style: const TextStyle(fontWeight: FontWeight.w700)),
                          selected: amount == value,
                          onSelected: paying
                              ? null
                              : (_) => setState(() {
                                  amount = value;
                                  customAmount.text = '$value';
                                }),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: customAmount,
                    enabled: !paying,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'Amount (RWF)'),
                    style: const TextStyle(fontSize: 20),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phone,
                    enabled: !paying,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Your mobile money number',
                      hintText: '078… or 073…',
                    ),
                    style: const TextStyle(fontSize: 20),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: navy,
                      minimumSize: const Size.fromHeight(58),
                      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    onPressed: paying ? null : _topUp,
                    child: Text(paying ? 'Waiting for your phone…' : 'Add money to wallet'),
                  ),
                  const SizedBox(height: 28),
                  const Text('Money you added', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (topUps.isEmpty)
                    const Text(
                      'No top-ups yet. When you add money, it will show here.',
                      style: TextStyle(fontSize: 16, height: 1.4, color: muted),
                    )
                  else
                    for (final row in topUps) _ActivityTile(row: row, incoming: true),
                  const SizedBox(height: 24),
                  const Text(
                    'Recent meals and updates',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: navy),
                  ),
                  const SizedBox(height: 8),
                  if (activity.isEmpty)
                    const Text(
                      'Meals paid by fingerprint will appear here.',
                      style: TextStyle(fontSize: 16, height: 1.4, color: muted),
                    )
                  else
                    for (final row in activity) _ActivityTile(row: row, incoming: !row.isMeal),
                ],
              ),
            ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.row, required this.incoming});

  final PortalActivity row;
  final bool incoming;

  @override
  Widget build(BuildContext context) {
    final where = [
      friendlyWhen(row.when),
      if (row.canteenName != null && row.canteenName!.isNotEmpty) row.canteenName!,
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(row.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        subtitle: Text(where),
        trailing: Text(
          '${incoming ? '+' : '−'}${rwf(row.amountRwf)}',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: incoming ? teal : navy),
        ),
      ),
    );
  }
}
