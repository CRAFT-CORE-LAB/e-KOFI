import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/session.dart';
import 'parent_home_screen.dart';
import 'shell_screen.dart';
import 'student_home_screen.dart';

/// Staff, parents, and students share one app and land on their own home.
class SessionHome extends StatelessWidget {
  const SessionHome({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    if (session.isParent) return const ParentHomeScreen();
    if (session.isStudent) return const StudentHomeScreen();
    return const ShellScreen();
  }
}
