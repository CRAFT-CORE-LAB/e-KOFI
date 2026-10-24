import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../navigation/corner_reveal_route.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'login_screen.dart';
import 'shell_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  bool adminRole = true;
  bool hide = true;
  bool saving = false;
  String? error;
  final _submitKey = GlobalKey();

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (name.text.trim().length < 2) {
      setState(() => error = 'Enter your name.');
      return;
    }
    if (!email.text.contains('@')) {
      setState(() => error = 'Enter a valid email.');
      return;
    }
    if (password.text.length < 8) {
      setState(() => error = 'Password must be at least 8 characters.');
      return;
    }
    if (password.text != confirm.text) {
      setState(() => error = 'The passwords do not match.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await context.read<SessionController>().register(
        name: name.text.trim(),
        email: email.text.trim(),
        password: password.text,
        role: adminRole ? 'ADMIN' : 'CASHIER',
      );
      if (!mounted) return;
      // One reveal, from the submit button, into Home. Replacing this route
      // means Back does not return to the empty form.
      final origin = CornerRevealRoute.centerOf(_submitKey, context);
      await CornerRevealRoute.push<void>(
        context,
        page: const ShellScreen(),
        origin: origin,
        replace: true,
      );
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: revealTheme(context),
      child: Scaffold(
        backgroundColor: white,
        appBar: AppBar(
          backgroundColor: white,
          title: const Text('Create account'),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          children: [
            const RevealField(index: 0, child: Center(child: BrandLogo(height: 72))),
            const SizedBox(height: 20),
            const RevealField(
              index: 1,
              child: Text(
                'Choose how you will use e-KOFI.',
                style: TextStyle(fontFamily: 'Poppins', color: navy, fontSize: 16, height: 1.4),
              ),
            ),
            const SizedBox(height: 16),
            RevealField(
              index: 2,
              child: Row(
                children: [
                  Expanded(
                    child: _RoleCard(
                      title: 'Admin',
                      subtitle: 'Register students',
                      selected: adminRole,
                      onTap: () => setState(() => adminRole = true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _RoleCard(
                      title: 'Canteen',
                      subtitle: 'Take payments',
                      selected: !adminRole,
                      onTap: () => setState(() => adminRole = false),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            RevealField(
              index: 3,
              child: TextField(controller: name, decoration: const InputDecoration(labelText: 'Your name')),
            ),
            const SizedBox(height: 12),
            RevealField(
              index: 4,
              child: TextField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
            ),
            const SizedBox(height: 12),
            RevealField(
              index: 5,
              child: TextField(
                controller: password,
                obscureText: hide,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
            ),
            const SizedBox(height: 12),
            RevealField(
              index: 6,
              child: TextField(
                controller: confirm,
                obscureText: hide,
                decoration: InputDecoration(
                  labelText: 'Confirm password',
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => hide = !hide),
                    icon: Icon(hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: navy),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (error != null)
              Text(error!, style: const TextStyle(fontFamily: 'Poppins', color: navy, height: 1.35)),
            RevealField(
              index: 7,
              child: FilledButton(
                key: _submitKey,
                onPressed: saving ? null : _submit,
                child: Text(saving ? 'Creating account…' : 'Create account'),
              ),
            ),
            RevealField(
              index: 8,
              child: TextButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                child: const Text(
                  'Sign in',
                  style: TextStyle(fontFamily: 'Poppins', color: navy, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? teal : white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? teal : navy, width: 1.4),
          ),
          child: Column(
            children: [
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'Poppins',
                  fontWeight: FontWeight.w700,
                  color: selected ? white : navy,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  color: selected ? white : navy,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
