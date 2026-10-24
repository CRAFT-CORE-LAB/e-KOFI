import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'fingerprint_enroll_screen.dart';

class StudentFormScreen extends StatefulWidget {
  const StudentFormScreen({super.key, this.existing});

  final Student? existing;

  @override
  State<StudentFormScreen> createState() => _StudentFormScreenState();
}

class _StudentFormScreenState extends State<StudentFormScreen> {
  final studentCode = TextEditingController();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  List<School> schools = [];
  String? schoolId;
  String? classId;
  bool loading = true;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      studentCode.text = existing.studentCode;
      firstName.text = existing.firstName;
      lastName.text = existing.lastName;
      schoolId = existing.school?.id;
      classId = existing.schoolClass?.id;
    }
    _loadSchools();
  }

  @override
  void dispose() {
    studentCode.dispose();
    firstName.dispose();
    lastName.dispose();
    super.dispose();
  }

  Future<void> _loadSchools() async {
    try {
      schools = await context.read<SessionController>().api.schools();
      schoolId ??= schools.firstOrNull?.id;
      classId ??= schools
          .where((s) => s.id == schoolId)
          .expand((s) => s.classes)
          .firstOrNull
          ?.id;
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _save() async {
    final idValue = studentCode.text.trim();
    if (idValue.length < 2) {
      showError(context, 'Enter the student ID. This is the main identifier.');
      return;
    }
    if (firstName.text.trim().isEmpty || lastName.text.trim().isEmpty) {
      showError(context, 'Enter the student’s first and last name.');
      return;
    }
    if (schoolId == null || classId == null) {
      showError(context, 'Choose a school and class.');
      return;
    }
    setState(() => saving = true);
    final api = context.read<SessionController>().api;
    final body = <String, dynamic>{
      'studentCode': idValue,
      'firstName': firstName.text.trim(),
      'lastName': lastName.text.trim(),
      'schoolId': schoolId,
      'classId': classId,
    };
    try {
      if (widget.existing == null) {
        final created = await api.createStudent(body);
        if (!mounted) return;
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => FingerprintEnrollScreen(
              studentId: created.id,
              studentName: '${created.fullName} · ${created.studentCode}',
            ),
          ),
        );
      } else {
        await api.updateStudent(widget.existing!.id, body);
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classes = schools.where((s) => s.id == schoolId).expand((s) => s.classes).toList();
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Register student' : 'Edit student')),
      body: loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                TextField(
                  controller: studentCode,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Student ID',
                    hintText: 'e.g. 2024-0148',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(controller: firstName, decoration: const InputDecoration(labelText: 'First name')),
                const SizedBox(height: 12),
                TextField(controller: lastName, decoration: const InputDecoration(labelText: 'Last name')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: schoolId,
                  decoration: const InputDecoration(labelText: 'School'),
                  items: schools
                      .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                      .toList(),
                  onChanged: (value) => setState(() {
                    schoolId = value;
                    classId = schools
                        .where((s) => s.id == value)
                        .expand((s) => s.classes)
                        .firstOrNull
                        ?.id;
                  }),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: classId,
                  decoration: const InputDecoration(labelText: 'Class'),
                  items: classes
                      .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                      .toList(),
                  onChanged: (value) => setState(() => classId = value),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: saving ? null : _save,
                  child: Text(
                    saving
                        ? 'Saving…'
                        : widget.existing == null
                        ? 'Save and capture fingerprint'
                        : 'Save changes',
                  ),
                ),
              ],
            ),
    );
  }
}
