import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class ChangeEmailScreen extends StatefulWidget {
  const ChangeEmailScreen({super.key});

  @override
  State<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends State<ChangeEmailScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool hide = true;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    email.text = context.read<SessionController>().user?.email ?? '';
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!email.text.contains('@')) {
      showError(context, 'Enter a valid email.');
      return;
    }
    setState(() => saving = true);
    try {
      await context.read<SessionController>().changeEmail(
        email: email.text.trim(),
        password: password.text,
      );
      if (!mounted) return;
      await showInfo(context, 'Email updated', 'Use this email the next time you sign in.');
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change email')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'New email'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: password,
            obscureText: hide,
            decoration: InputDecoration(
              labelText: 'Current password',
              suffixIcon: IconButton(
                onPressed: () => setState(() => hide = !hide),
                icon: Icon(hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: muted),
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: saving ? null : _save,
            child: Text(saving ? 'Saving…' : 'Save email'),
          ),
        ],
      ),
    );
  }
}
