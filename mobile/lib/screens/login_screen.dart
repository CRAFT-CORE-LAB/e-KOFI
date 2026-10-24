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
    final url = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Connection'),
        content: TextField(controller: controller),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
        ],
      ),
    );
    if (url != null && url.isNotEmpty) {
      await session.updateApiUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    return Scaffold(
      backgroundColor: canvas,
      body: Stack(
        children: [
          const BrandWatermark(),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
                  children: [
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: _onLogoTap,
                      child: const Align(
                        alignment: Alignment.centerLeft,
                        child: BrandLogo(height: 52),
                      ),
                    ),
                    const SizedBox(height: 36),
                    const Text(
                      'Welcome',
                      style: TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        color: navy,
                        height: 1.1,
                        letterSpacing: -0.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Sign in to take meal payments, look after student wallets, and keep the canteen moving.',
                      style: TextStyle(color: muted, fontSize: 16, height: 1.45),
                    ),
                    const SizedBox(height: 32),
                    Container(
                      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                      decoration: BoxDecoration(
                        color: white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: navy.withValues(alpha: 0.06),
                            blurRadius: 28,
                            offset: const Offset(0, 12),
                          ),
                        ],
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
                    const SizedBox(height: 28),
                    const Text(
                      'For school staff only',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
