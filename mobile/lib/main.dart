import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';
import 'state/session.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(EkofiApp(api: ApiClient()));
}

class EkofiApp extends StatelessWidget {
  const EkofiApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SessionController(api)..bootstrap(),
      child: MaterialApp(
        title: 'e-KOFI',
        debugShowCheckedModeBanner: false,
        theme: ekofiTheme(),
        home: const _Gate(),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    if (session.ready && session.isLoggedIn) {
      return const ShellScreen();
    }
    return const LoginScreen();
  }
}
