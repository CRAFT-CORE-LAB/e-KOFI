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

  Future<void> _confirmDelete(Student student) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove student'),
        content: Text('Remove ${student.fullName} (${student.studentCode}) from the register?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<SessionController>().api.deleteStudent(student.id);
      _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
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
    } catch (e) {
      error = e.toString();
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
                hintText: 'Find by student ID or name',
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
                            title: Text(student.studentCode, style: const TextStyle(fontWeight: FontWeight.w800)),
                            subtitle: Text(
                              [
                                student.fullName,
                                student.schoolClass?.name,
                              ].where((p) => p != null && p.toString().isNotEmpty).join(' · '),
                              style: const TextStyle(color: muted),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (student.hasFingerprint) const Icon(Icons.fingerprint, color: teal),
                                if (admin)
                                  PopupMenuButton<String>(
                                    onSelected: (value) async {
                                      if (value == 'edit') {
                                        await Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => StudentFormScreen(existing: student),
                                          ),
                                        );
                                        _load();
                                      } else if (value == 'delete') {
                                        await _confirmDelete(student);
                                      }
                                    },
                                    itemBuilder: (context) => const [
                                      PopupMenuItem(value: 'edit', child: Text('Edit')),
                                      PopupMenuItem(value: 'delete', child: Text('Remove')),
                                    ],
                                  )
                                else
                                  StatusChip(label: student.status, ok: student.isActive),
                              ],
                            ),
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
