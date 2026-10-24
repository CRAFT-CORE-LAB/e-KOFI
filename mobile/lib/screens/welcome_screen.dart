import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../navigation/corner_reveal_route.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'register_screen.dart';
import 'shell_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  void _open(BuildContext context, Widget page, {bool replace = false}) {
    final route = PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.06),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
            child: child,
          ),
        );
      },
    );
    if (replace) {
      Navigator.of(context).pushAndRemoveUntil(route, (_) => false);
    } else {
      Navigator.of(context).push(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
          child: Column(
            children: [
              const Spacer(),
              const BrandLogo(height: 120),
              const Spacer(),
              _GetStartedButton(onPressed: (origin) {
                final session = context.read<SessionController>();
                if (session.isLoggedIn) {
                  _open(context, const ShellScreen(), replace: true);
                  return;
                }
                CornerRevealRoute.push(context, page: const RegisterScreen(), origin: origin);
              }),
            ],
          ),
        ),
      ),
    );
  }
}

/// Owns the arrow key so the reveal can start on that icon, at the
/// bottom-right of the Get started button.
class _GetStartedButton extends StatefulWidget {
  const _GetStartedButton({required this.onPressed});

  final void Function(Offset origin) onPressed;

  @override
  State<_GetStartedButton> createState() => _GetStartedButtonState();
}

class _GetStartedButtonState extends State<_GetStartedButton> {
  final _arrowKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: navy,
          foregroundColor: white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        onPressed: () => widget.onPressed(CornerRevealRoute.centerOf(_arrowKey, context)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Get started'),
            const SizedBox(width: 10),
            Icon(Icons.arrow_forward_rounded, key: _arrowKey, size: 20),
          ],
        ),
      ),
    );
  }
}
