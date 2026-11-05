import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../navigation/corner_reveal_route.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'login_screen.dart';
import 'session_home.dart';

enum _Audience { admin, canteen, parent, student }

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
  final studentCode = TextEditingController();
  _Audience audience = _Audience.admin;
  PortalStudent? studentPreview;
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
    studentCode.dispose();
    super.dispose();
  }

  void _choose(_Audience next) {
    setState(() {
      audience = next;
      error = null;
      studentPreview = null;
    });
  }

  Future<void> _openHome() async {
    if (!mounted) return;
    final origin = CornerRevealRoute.centerOf(_submitKey, context);
    await CornerRevealRoute.push<void>(
      context,
      page: const SessionHome(),
      origin: origin,
      replace: true,
    );
  }

  Future<void> _submit() async {
    if (audience == _Audience.parent) {
      await _openParent();
      return;
    }
    if (audience == _Audience.student) {
      await _openStudent();
      return;
    }
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
        role: audience == _Audience.admin ? 'ADMIN' : 'CASHIER',
      );
      await _openHome();
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _openParent() async {
    if (studentCode.text.trim().length < 2) {
      setState(() => error = 'Enter the Student ID from school.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await context.read<SessionController>().openParent(studentCode.text.trim());
      await _openHome();
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _openStudent() async {
    final code = studentCode.text.trim();
    if (code.length < 2) {
      setState(() => error = 'Enter your Student ID.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      if (studentPreview == null) {
        final lookup = await context.read<SessionController>().lookupStudent(code);
        if (!mounted) return;
        if (lookup.hasAccount) {
          setState(() => error = 'This Student ID already has an account. Use Sign in.');
          return;
        }
        setState(() => studentPreview = lookup.student);
        return;
      }
      if (password.text.length < 6) {
        setState(() => error = 'Password must be at least 6 characters.');
        return;
      }
      if (password.text != confirm.text) {
        setState(() => error = 'The passwords do not match.');
        return;
      }
      await context.read<SessionController>().registerStudent(studentCode: code, password: password.text);
      await _openHome();
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final family = audience == _Audience.parent || audience == _Audience.student;
    final studentReady = audience == _Audience.student && studentPreview != null;
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
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _RoleCard(
                          title: 'Admin',
                          subtitle: 'Register students',
                          selected: audience == _Audience.admin,
                          onTap: () => _choose(_Audience.admin),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _RoleCard(
                          title: 'Canteen',
                          subtitle: 'Take payments',
                          selected: audience == _Audience.canteen,
                          onTap: () => _choose(_Audience.canteen),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _RoleCard(
                          title: 'Parent',
                          subtitle: 'Add lunch money',
                          selected: audience == _Audience.parent,
                          onTap: () => _choose(_Audience.parent),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _RoleCard(
                          title: 'Student',
                          subtitle: 'See your wallet',
                          selected: audience == _Audience.student,
                          onTap: () => _choose(_Audience.student),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (family) ...[
              RevealField(
                index: 3,
                child: TextField(
                  controller: studentCode,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    labelText: 'Student ID',
                    hintText: audience == _Audience.parent ? 'From the school' : 'Your Student ID',
                  ),
                  onChanged: (_) {
                    if (studentPreview != null) setState(() => studentPreview = null);
                  },
                ),
              ),
              if (studentReady) ...[
                const SizedBox(height: 14),
                Text(
                  studentPreview!.fullName,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy),
                ),
                const SizedBox(height: 4),
                Text(
                  '${studentPreview!.schoolName} · Class ${studentPreview!.className}',
                  style: const TextStyle(fontSize: 16, color: muted, height: 1.35),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: hide,
                  decoration: const InputDecoration(labelText: 'New password'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirm,
                  obscureText: hide,
                  decoration: InputDecoration(
                    labelText: 'Type password again',
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => hide = !hide),
                      icon: Icon(hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: navy),
                    ),
                  ),
                ),
              ],
            ] else ...[
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
            ],
            const SizedBox(height: 16),
            if (error != null)
              Text(error!, style: const TextStyle(fontFamily: 'Poppins', color: navy, height: 1.35)),
            RevealField(
              index: 7,
              child: FilledButton(
                key: _submitKey,
                onPressed: saving ? null : _submit,
                child: Text(
                  saving
                      ? 'One moment…'
                      : audience == _Audience.parent
                          ? 'Open child’s wallet'
                          : audience == _Audience.student && studentPreview == null
                              ? 'Continue'
                              : 'Create account',
                ),
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
