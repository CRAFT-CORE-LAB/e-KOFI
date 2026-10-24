import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'change_email_screen.dart';
import 'change_password_screen.dart';
import 'canteens_screen.dart';
import 'dashboard_screen.dart';
import 'fingerprints_screen.dart';
import 'welcome_screen.dart';
import 'purchase_screen.dart';
import 'students_screen.dart';
import 'transactions_screen.dart';
import 'withdraw_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    final pages = admin
        ? const [DashboardScreen(), StudentsScreen(), FingerprintsScreen(), MoreScreen()]
        : const [DashboardScreen(), PurchaseScreen(), TransactionsScreen(), MoreScreen()];
    final safeIndex = index < pages.length ? index : 0;
    final items = admin
        ? const [
            MagicNavItem(icon: Icons.home_outlined, selectedIcon: Icons.home_rounded, label: 'Home'),
            MagicNavItem(icon: Icons.groups_outlined, selectedIcon: Icons.groups_rounded, label: 'Students'),
            MagicNavItem(icon: Icons.fingerprint, selectedIcon: Icons.fingerprint, label: 'Fingers'),
            MagicNavItem(icon: Icons.more_horiz, selectedIcon: Icons.auto_awesome, label: 'More'),
          ]
        : const [
            MagicNavItem(icon: Icons.home_outlined, selectedIcon: Icons.home_rounded, label: 'Home'),
            MagicNavItem(icon: Icons.payments_outlined, selectedIcon: Icons.payments_rounded, label: 'Pay'),
            MagicNavItem(icon: Icons.receipt_long_outlined, selectedIcon: Icons.receipt_long, label: 'Paid'),
            MagicNavItem(icon: Icons.more_horiz, selectedIcon: Icons.auto_awesome, label: 'More'),
          ];
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 420),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.05, 0.04),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          );
        },
        child: KeyedSubtree(key: ValueKey('tab-$safeIndex-${admin ? 'a' : 'c'}'), child: pages[safeIndex]),
      ),
      bottomNavigationBar: MagicNavBar(
        index: safeIndex,
        items: items,
        onChanged: (value) => setState(() => index = value),
      ),
    );
  }
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final user = session.user;
    final canteen = session.isCanteen;
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  InitialsAvatar(name: user?.name ?? 'Staff', size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? 'Staff',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: navy),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          friendlyRole(user?.role ?? ''),
                          style: const TextStyle(color: muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (canteen) ...[
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.account_balance_wallet_outlined, color: teal),
                    title: const Text('Withdraw with Intouch'),
                    subtitle: const Text('Send canteen money to MTN or Airtel'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const WithdrawScreen()),
                    ),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.storefront_outlined, color: teal),
                    title: const Text('Canteens'),
                    subtitle: const Text('Counters and daily totals'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CanteensScreen()),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.alternate_email, color: teal),
                  title: const Text('Change email'),
                  subtitle: Text(user?.email ?? 'Update the email for this sign-in'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChangeEmailScreen()),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.lock_outline, color: teal),
                  title: const Text('Change password'),
                  subtitle: const Text('Update the password for this sign-in'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout, color: Color(0xFFB42318)),
                  title: const Text('Sign out'),
                  onTap: () async {
                    await session.logout();
                    if (!context.mounted) return;
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
                      (_) => false,
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
