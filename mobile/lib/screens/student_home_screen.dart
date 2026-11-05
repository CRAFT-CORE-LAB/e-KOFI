import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'welcome_screen.dart';

class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> {
  PortalWallet? wallet;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => error = null);
    try {
      final data = await context.read<SessionController>().api.studentWallet();
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

  Future<void> _signOut() async {
    await context.read<SessionController>().logout();
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
    final credits = activity
        .where((row) => row.type == 'PARENT_TOPUP' || row.type == 'TEST_CREDIT' || row.type == 'REVERSAL')
        .toList();
    final meals = activity.where((row) => row.type == 'PURCHASE').toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('My wallet'),
        actions: [
          TextButton(onPressed: _signOut, child: const Text('Sign out')),
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
                    student?.fullName ?? 'Student',
                    style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: navy, height: 1.15),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${student?.schoolName ?? ''}  ·  Class ${student?.className ?? ''}',
                    style: const TextStyle(fontSize: 17, color: navy, height: 1.35),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Student ID ${student?.studentCode ?? ''}',
                    style: const TextStyle(fontSize: 16, color: muted),
                  ),
                  if (student != null && !student.isActive) ...[
                    const SizedBox(height: 8),
                    Text(
                      friendlyStatus(student.status),
                      style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFB42318)),
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 14),
                    ErrorBanner(message: error!),
                  ],
                  const SizedBox(height: 18),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Money for meals', style: TextStyle(fontSize: 16, color: muted)),
                          const SizedBox(height: 6),
                          Text(
                            rwf(wallet?.balanceRwf ?? 0),
                            style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: navy),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pay for meals at the canteen with your fingerprint. This screen shows the money and the meals.',
                    style: TextStyle(fontSize: 15, height: 1.4, color: muted),
                  ),
                  const SizedBox(height: 22),
                  const Text('Money added', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (credits.isEmpty)
                    const Text(
                      'When parents or the school add money, it shows here.',
                      style: TextStyle(fontSize: 16, height: 1.4, color: muted),
                    )
                  else
                    for (final row in credits) _MoneyTile(row: row, incoming: true),
                  const SizedBox(height: 22),
                  const Text('Meals you paid', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (meals.isEmpty)
                    const Text(
                      'When you pay at the canteen with your finger, meals appear here.',
                      style: TextStyle(fontSize: 16, height: 1.4, color: muted),
                    )
                  else
                    for (final row in meals) _MoneyTile(row: row, incoming: false),
                  const SizedBox(height: 22),
                  const Text('All activity', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(height: 8),
                  if (activity.isEmpty)
                    const Text('No transactions yet.', style: TextStyle(fontSize: 16, color: muted))
                  else
                    for (final row in activity) _MoneyTile(row: row, incoming: !row.isMeal),
                ],
              ),
            ),
    );
  }
}

class _MoneyTile extends StatelessWidget {
  const _MoneyTile({required this.row, required this.incoming});

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
        title: Text(row.label, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(where),
        trailing: Text(
          '${incoming ? '+' : '−'}${rwf(row.amountRwf)}',
          style: TextStyle(fontWeight: FontWeight.w800, color: incoming ? teal : navy),
        ),
      ),
    );
  }
}
