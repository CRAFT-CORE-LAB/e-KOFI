import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final current = TextEditingController();
  final next = TextEditingController();
  final confirm = TextEditingController();
  bool hide = true;
  bool saving = false;

  @override
  void dispose() {
    current.dispose();
    next.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (next.text.trim().length < 8) {
      showError(context, 'New password must be at least 8 characters.');
      return;
    }
    if (next.text != confirm.text) {
      showError(context, 'The new passwords do not match.');
      return;
    }
    setState(() => saving = true);
    try {
      await context.read<SessionController>().api.changePassword(
        currentPassword: current.text,
        newPassword: next.text,
      );
      if (!mounted) return;
      await showInfo(context, 'Password updated', 'Use the new password the next time you sign in.');
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
      appBar: AppBar(title: const Text('Change password')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const Text(
            'Enter the current password, then choose a new one for this account.',
            style: TextStyle(color: muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: current,
            obscureText: hide,
            decoration: const InputDecoration(labelText: 'Current password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: next,
            obscureText: hide,
            decoration: const InputDecoration(labelText: 'New password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: confirm,
            obscureText: hide,
            decoration: InputDecoration(
              labelText: 'Confirm new password',
              suffixIcon: IconButton(
                onPressed: () => setState(() => hide = !hide),
                icon: Icon(hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: muted),
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: saving ? null : _save,
            child: Text(saving ? 'Saving…' : 'Save password'),
          ),
        ],
      ),
    );
  }
}
