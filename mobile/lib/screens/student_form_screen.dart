import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../widgets.dart';
import 'fingerprint_enroll_screen.dart';

class StudentFormScreen extends StatefulWidget {
  const StudentFormScreen({super.key, this.existing});

  final Student? existing;

  @override
  State<StudentFormScreen> createState() => _StudentFormScreenState();
}

class _StudentFormScreenState extends State<StudentFormScreen> {
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final pin = TextEditingController();
  List<School> schools = [];
  String? schoolId;
  String? classId;
  bool pinEnabled = false;
  bool loading = true;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      firstName.text = existing.firstName;
      lastName.text = existing.lastName;
      pinEnabled = existing.pinEnabled;
      schoolId = existing.school?.id;
      classId = existing.schoolClass?.id;
    }
    _loadSchools();
  }

  @override
  void dispose() {
    firstName.dispose();
    lastName.dispose();
    pin.dispose();
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
    setState(() => saving = true);
    final api = context.read<SessionController>().api;
    final body = <String, dynamic>{
      'firstName': firstName.text.trim(),
      'lastName': lastName.text.trim(),
      'schoolId': schoolId,
      'classId': classId,
      'pinEnabled': pinEnabled || pin.text.isNotEmpty,
      if (pin.text.isNotEmpty) 'pin': pin.text,
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
              studentName: created.fullName,
            ),
          ),
        );
      } else {
        await api.updateStudent(widget.existing!.id, body);
      }
      if (mounted) Navigator.pop(context);
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
                SwitchListTile(
                  title: const Text('Ask for a PIN at payment'),
                  value: pinEnabled,
                  onChanged: (value) => setState(() => pinEnabled = value),
                ),
                TextField(
                  controller: pin,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'PIN (4–6 digits, optional)'),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: saving ? null : _save,
                  child: Text(saving ? 'Saving…' : 'Save student'),
                ),
              ],
            ),
    );
  }
}
