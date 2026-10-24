import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'fingerprint_enroll_screen.dart';

class FingerprintsScreen extends StatefulWidget {
  const FingerprintsScreen({super.key});

  @override
  State<FingerprintsScreen> createState() => _FingerprintsScreenState();
}

class _FingerprintsScreenState extends State<FingerprintsScreen> {
  List<Student> students = [];
  bool loading = true;
  String? error;

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
      students = await context.read<SessionController>().api.students(status: 'ACTIVE');
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _enroll(Student student) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FingerprintEnrollScreen(
          studentId: student.id,
          studentName: student.fullName,
        ),
      ),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    final enrolled = students.where((s) => s.hasFingerprint).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Fingerprints')),
      body: loading
          ? const LoadingView()
          : RefreshIndicator(
              color: teal,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (error != null) ErrorBanner(message: error!),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Icon(Icons.fingerprint, color: teal, size: 32),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              '$enrolled of ${students.length} students have a fingerprint on file.',
                              style: const TextStyle(color: navy, height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Plug the Live20R into this phone, open a student, and capture their finger. No cards are needed.',
                    style: TextStyle(color: muted, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  if (students.isEmpty)
                    const EmptyState(
                      icon: Icons.groups_outlined,
                      title: 'No students yet',
                      message: 'Register a student first, then add their fingerprint.',
                    )
                  else
                    ...students.map(
                      (student) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
                            leading: InitialsAvatar(name: student.fullName),
                            title: Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text(
                              student.hasFingerprint
                                  ? '${student.fingerprints.length} fingerprint${student.fingerprints.length == 1 ? '' : 's'} saved'
                                  : 'Not registered yet',
                              style: const TextStyle(color: muted),
                            ),
                            trailing: admin
                                ? TextButton(
                                    onPressed: () => _enroll(student),
                                    child: Text(student.hasFingerprint ? 'Update' : 'Register'),
                                  )
                                : StatusChip(
                                    label: student.hasFingerprint ? 'ACTIVE' : 'INACTIVE',
                                    ok: student.hasFingerprint,
                                  ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
