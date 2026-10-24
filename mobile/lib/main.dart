import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'screens/welcome_screen.dart';
import 'state/session.dart';
import 'theme.dart';
import 'widgets.dart';

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
        builder: (context, child) {
          return ColoredBox(
            color: canvas,
            child: Stack(
              children: [
                const Positioned.fill(child: AppGridBackground(lively: true)),
                const Positioned.fill(child: BrandWatermark()),
                child ?? const SizedBox.shrink(),
              ],
            ),
          );
        },
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
    if (!session.ready) {
      return const Scaffold(body: LoadingView());
    }
    return const WelcomeScreen();
  }
}
