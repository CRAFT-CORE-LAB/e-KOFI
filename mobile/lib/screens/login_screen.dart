import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'shell_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool hidePassword = true;
  int _logoTaps = 0;
  bool adminPortal = true;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<SessionController>();
    final ok = await session.login(email.text.trim(), password.text);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ShellScreen()),
      );
    }
  }

  void _onLogoTap() {
    _logoTaps += 1;
    if (_logoTaps < 7) return;
    _logoTaps = 0;
    _openHiddenConnection();
  }

  Future<void> _openHiddenConnection() async {
    final session = context.read<SessionController>();
    final controller = TextEditingController(text: session.api.baseUrl);
    final scanner = TextEditingController(
      text: session.api.scannerUrl.isEmpty ? 'http://192.168.1.112:8787' : session.api.scannerUrl,
    );
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Connection'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: controller, decoration: const InputDecoration(labelText: 'Service')),
            const SizedBox(height: 12),
            TextField(controller: scanner, decoration: const InputDecoration(labelText: 'Fingerprint reader')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (saved == true) {
      if (controller.text.isNotEmpty) await session.updateApiUrl(controller.text);
      if (scanner.text.isNotEmpty) await session.updateScannerUrl(scanner.text);
    }
    controller.dispose();
    scanner.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
                    children: [
                const SizedBox(height: 28),
                const Text(
                  'Welcome',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    color: navy,
                    letterSpacing: -0.6,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  adminPortal ? 'Good to have you back.' : 'Ready when the students are.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: muted, fontSize: 16, height: 1.4),
                ),
                const SizedBox(height: 28),
                GestureDetector(
                  onTap: _onLogoTap,
                  child: const Center(child: BrandLogo(height: 72)),
                ),
                const SizedBox(height: 28),
                Row(
                  children: [
                    Expanded(
                      child: _PortalChip(
                        label: 'Admin',
                        selected: adminPortal,
                        onTap: () => setState(() => adminPortal = true),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PortalChip(
                        label: 'Canteen',
                        selected: !adminPortal,
                        onTap: () => setState(() => adminPortal = false),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                  decoration: BoxDecoration(
                    color: white.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: navy.withValues(alpha: 0.06)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username, AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.mail_outline, color: muted),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: password,
                        obscureText: hidePassword,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline, color: muted),
                          suffixIcon: IconButton(
                            onPressed: () => setState(() => hidePassword = !hidePassword),
                            icon: Icon(
                              hidePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: muted,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      if (session.error != null) ErrorBanner(message: session.error!),
                      FilledButton(
                        onPressed: session.busy ? null : _submit,
                        child: Text(session.busy ? 'Signing in…' : 'Sign in'),
                      ),
                    ],
                  ),
                ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PortalChip extends StatelessWidget {
  const _PortalChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? teal : white.withValues(alpha: 0.45),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? teal : navy.withValues(alpha: 0.08)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? white : navy,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
