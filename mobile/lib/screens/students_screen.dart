import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'student_detail_screen.dart';
import 'student_form_screen.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  final search = TextEditingController();
  List<Student> items = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      items = await context.read<SessionController>().api.students(query: search.text);
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Students')),
      floatingActionButton: admin
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const StudentFormScreen()),
                );
                _load();
              },
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Add student'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: search,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search, color: muted),
                hintText: 'Find a student',
              ),
              onSubmitted: (_) => _load(),
              onChanged: (value) {
                if (value.isEmpty) _load();
              },
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ErrorBanner(message: error!),
            ),
          Expanded(
            child: loading
                ? const LoadingView()
                : items.isEmpty
                ? const EmptyState(
                    icon: Icons.groups_outlined,
                    title: 'No students found',
                    message: 'Try another name, or add a student to get started.',
                  )
                : RefreshIndicator(
                    color: teal,
                    onRefresh: _load,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final student = items[i];
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            leading: InitialsAvatar(name: student.fullName),
                            title: Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text(
                              [
                                student.studentCode,
                                student.schoolClass?.name,
                                if (student.wallet != null) rwf(student.wallet!.balanceRwf),
                              ].where((p) => p != null && p.toString().isNotEmpty).join(' · '),
                              style: const TextStyle(color: muted),
                            ),
                            trailing: student.hasFingerprint
                                ? const Icon(Icons.fingerprint, color: teal)
                                : StatusChip(label: student.status, ok: student.isActive),
                            onTap: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => StudentDetailScreen(studentId: student.id),
                                ),
                              );
                              _load();
                            },
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
