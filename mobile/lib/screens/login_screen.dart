import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'session_home.dart';

enum _SignInAs { admin, canteen, parent, student }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final studentCode = TextEditingController();
  final password = TextEditingController();
  bool hidePassword = true;
  int _logoTaps = 0;
  _SignInAs audience = _SignInAs.admin;

  @override
  void dispose() {
    email.dispose();
    studentCode.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _enter() async {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const SessionHome()),
    );
  }

  Future<void> _submit() async {
    final session = context.read<SessionController>();
    if (audience == _SignInAs.parent) {
      try {
        await session.openParent(studentCode.text.trim());
        await _enter();
      } catch (_) {}
      return;
    }
    if (audience == _SignInAs.student) {
      final ok = await session.loginStudent(studentCode.text.trim(), password.text);
      if (!mounted) return;
      if (ok) await _enter();
      return;
    }
    final ok = await session.login(email.text.trim(), password.text);
    if (!mounted) return;
    if (ok) await _enter();
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
                  switch (audience) {
                    _SignInAs.parent => 'Open your child’s wallet with their Student ID.',
                    _SignInAs.student => 'Sign in with your Student ID and password.',
                    _SignInAs.canteen => 'Ready when the students are.',
                    _SignInAs.admin => 'Good to have you back.',
                  },
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
                        selected: audience == _SignInAs.admin,
                        onTap: () => setState(() => audience = _SignInAs.admin),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PortalChip(
                        label: 'Canteen',
                        selected: audience == _SignInAs.canteen,
                        onTap: () => setState(() => audience = _SignInAs.canteen),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _PortalChip(
                        label: 'Parent',
                        selected: audience == _SignInAs.parent,
                        onTap: () => setState(() => audience = _SignInAs.parent),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PortalChip(
                        label: 'Student',
                        selected: audience == _SignInAs.student,
                        onTap: () => setState(() => audience = _SignInAs.student),
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
                      if (audience == _SignInAs.parent || audience == _SignInAs.student)
                        TextField(
                          controller: studentCode,
                          textCapitalization: TextCapitalization.characters,
                          textInputAction: audience == _SignInAs.parent ? TextInputAction.done : TextInputAction.next,
                          onSubmitted: audience == _SignInAs.parent ? (_) => _submit() : null,
                          decoration: const InputDecoration(
                            labelText: 'Student ID',
                            prefixIcon: Icon(Icons.badge_outlined, color: muted),
                          ),
                        )
                      else
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
                      if (audience != _SignInAs.parent) ...[
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
                      ],
                      const SizedBox(height: 18),
                      if (session.error != null) ErrorBanner(message: session.error!),
                      FilledButton(
                        onPressed: session.busy ? null : _submit,
                        child: Text(
                          session.busy
                              ? 'One moment…'
                              : audience == _SignInAs.parent
                                  ? 'Open wallet'
                                  : 'Sign in',
                        ),
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
