import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardStats? stats;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      stats = await context.read<SessionController>().api.dashboard();
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionController>().user;
    final name = firstNameOf(user?.name);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            const BrandMark(size: 34),
            const SizedBox(width: 10),
            const Text('e-KOFI'),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: teal,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Text(
              name.isEmpty ? greetingForNow() : '${greetingForNow()}, $name',
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: navy,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              friendlyRole(user?.role ?? ''),
              style: const TextStyle(color: muted, fontSize: 15),
            ),
            const SizedBox(height: 20),
            if (error != null) ErrorBanner(message: error!),
            if (loading && stats == null) const Padding(padding: EdgeInsets.only(top: 48), child: LoadingView()),
            if (stats != null) ...[
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.28,
                children: [
                  _StatCard('Students', '${stats!.students}', '${stats!.activeStudents} active today'),
                  _StatCard('Fingerprints', '${stats!.enrolledFingerprints}', 'Ready to pay'),
                  _StatCard('Canteens', '${stats!.canteens}', 'Open counters'),
                  _StatCard('Meals served', '${stats!.postedPurchases}', rwf(stats!.purchaseVolumeRwf)),
                ],
              ),
              const SizedBox(height: 24),
              const Text(
                'Recent activity',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: navy),
              ),
              const SizedBox(height: 10),
              if (stats!.recent.isEmpty)
                const EmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: 'No activity yet',
                  message: 'Meal payments will appear here as soon as they are taken.',
                )
              else
                ...stats!.recent.map(
                  (event) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: ListTile(
                        leading: InitialsAvatar(name: event.student?.fullName ?? 'Meal'),
                        title: Text(
                          event.student?.fullName ?? friendlyEvent(event.type),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          [
                            friendlyEvent(event.type),
                            if (event.canteenName != null && event.canteenName!.isNotEmpty) event.canteenName,
                          ].join(' · '),
                          style: const TextStyle(color: muted),
                        ),
                        trailing: Text(
                          rwf(event.amountRwf),
                          style: const TextStyle(fontWeight: FontWeight.w700, color: navy),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.hint);

  final String label;
  final String value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontWeight: FontWeight.w600, fontSize: 13)),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: navy, letterSpacing: -0.6),
            ),
            if (hint != null) ...[
              const SizedBox(height: 4),
              Text(hint!, style: const TextStyle(color: muted, fontSize: 12)),
            ],
          ],
        ),
      ),
    );
  }
}
