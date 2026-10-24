import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'fingerprint_enroll_screen.dart';
import 'student_form_screen.dart';
import 'wallet_screen.dart';

class StudentDetailScreen extends StatefulWidget {
  const StudentDetailScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<StudentDetailScreen> createState() => _StudentDetailScreenState();
}

class _StudentDetailScreenState extends State<StudentDetailScreen> {
  Student? student;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      student = await context.read<SessionController>().api.student(widget.studentId);
      error = null;
    } on ApiException catch (e) {
      error = e.message;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    final student = this.student;
    return Scaffold(
      appBar: AppBar(
        title: Text(student?.fullName ?? 'Student'),
        actions: [
          if (admin && student != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => StudentFormScreen(existing: student)),
                );
                _load();
              },
            ),
        ],
      ),
      body: student == null
          ? Center(child: error != null ? ErrorBanner(message: error!) : const LoadingView())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            InitialsAvatar(name: student.fullName, size: 56),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    student.fullName,
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: navy),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(student.studentCode, style: const TextStyle(color: muted)),
                                ],
                              ),
                            ),
                            StatusChip(label: student.status, ok: student.isActive),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${student.school?.name ?? ''} · ${student.schoolClass?.name ?? ''}',
                          style: const TextStyle(color: muted),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          student.wallet != null ? rwf(student.wallet!.balanceRwf) : '—',
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: navy),
                        ),
                        Text(
                          student.pinEnabled ? 'PIN required at payment' : 'No PIN required',
                          style: const TextStyle(color: muted),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  student.hasFingerprint
                      ? '${student.fingerprints.length} fingerprint${student.fingerprints.length == 1 ? '' : 's'} on file'
                      : 'No fingerprint registered yet',
                  style: const TextStyle(color: muted),
                ),
                const SizedBox(height: 16),
                if (admin)
                  FilledButton.icon(
                    onPressed: () async {
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
                    },
                    icon: const Icon(Icons.fingerprint),
                    label: Text(student.hasFingerprint ? 'Update fingerprint' : 'Register fingerprint'),
                  ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => WalletScreen(studentId: student.id)),
                  ),
                  child: const Text('Open wallet'),
                ),
                if (admin && student.isActive) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () async {
                      try {
                        await context.read<SessionController>().api.deactivateStudent(student.id);
                        _load();
                      } on ApiException catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: const Text('Deactivate student'),
                  ),
                ],
              ],
            ),
    );
  }
}
