import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Brand colors for this transition. Kept local so the reveal does not
/// pick up other theme colors.
const _navy = Color(0xFF0B1F3A);
const _teal = Color(0xFF14B8A6);
const _white = Color(0xFFFFFFFF);

/// How long the circle takes to cover the screen, and to shrink away again.
const _revealDuration = Duration(milliseconds: 600);

/// Opens [page] with the corner reveal. Popping the route plays it backwards,
/// so the system back button and the app bar back button both reverse it.
///
/// When the user has asked the OS to reduce motion, this is a short fade.
class CornerRevealRoute<T> extends PageRouteBuilder<T> {
  CornerRevealRoute({
    required Widget page,
    required Offset origin,
    required bool reducedMotion,
  }) : super(
          transitionDuration: reducedMotion ? const Duration(milliseconds: 200) : _revealDuration,
          reverseTransitionDuration: reducedMotion ? const Duration(milliseconds: 200) : _revealDuration,
          // Leave the screen underneath visible outside the growing circle.
          opaque: false,
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            if (reducedMotion) {
              return FadeTransition(opacity: animation, child: child);
            }
            final curved = CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOut,
              reverseCurve: Curves.easeInOut,
            );
            // One clip for the whole frame. A single oval is cheap to raster,
            // so this stays smooth at 60fps.
            return AnimatedBuilder(
              animation: curved,
              child: child,
              builder: (context, revealed) {
                return ClipPath(
                  clipper: _CircleRevealClipper(origin: origin, progress: curved.value),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      const ColoredBox(color: _teal),
                      FadeTransition(opacity: curved, child: revealed),
                    ],
                  ),
                );
              },
            );
          },
        );

  /// Center of a widget, used as the point the circle grows from.
  static Offset centerOf(GlobalKey key, BuildContext context) {
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (box != null && box.hasSize) {
      return box.localToGlobal(box.size.center(Offset.zero));
    }
    final size = MediaQuery.sizeOf(context);
    return Offset(size.width - 36, size.height - 56);
  }

  static Future<T?> push<T>(
    BuildContext context, {
    required Widget page,
    required Offset origin,
    bool replace = false,
  }) {
    final route = CornerRevealRoute<T>(
      page: page,
      origin: origin,
      reducedMotion: MediaQuery.disableAnimationsOf(context),
    );
    if (replace) {
      return Navigator.of(context).pushReplacement(route);
    }
    return Navigator.of(context).push(route);
  }
}

/// Circular clip that starts at [origin] and grows until it covers [size].
class _CircleRevealClipper extends CustomClipper<Path> {
  _CircleRevealClipper({required this.origin, required this.progress});

  final Offset origin;
  final double progress;

  @override
  Path getClip(Size size) {
    final radius = _farthestCorner(size) * progress.clamp(0.0, 1.0);
    return Path()..addOval(Rect.fromCircle(center: origin, radius: radius));
  }

  double _farthestCorner(Size size) {
    final corners = <Offset>[
      Offset.zero,
      Offset(size.width, 0),
      Offset(0, size.height),
      Offset(size.width, size.height),
    ];
    var farthest = 0.0;
    for (final corner in corners) {
      farthest = math.max(farthest, (corner - origin).distance);
    }
    return farthest;
  }

  @override
  bool shouldReclip(covariant _CircleRevealClipper oldClipper) {
    return oldClipper.progress != progress || oldClipper.origin != origin;
  }
}

/// One form block on the revealed page. Each [index] waits another 60ms,
/// then slides up 20px. Driven by the route animation, so going back
/// runs the same motion in reverse. Skipped when motion is reduced.
class RevealField extends StatelessWidget {
  const RevealField({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    final animation = ModalRoute.of(context)?.animation;
    if (animation == null) return child;

    // 60ms / 600ms = 0.1 of the route for each step.
    final start = (index * 0.1).clamp(0.0, 0.85);
    final end = math.min(1.0, start + 0.45);
    final curved = CurvedAnimation(
      parent: animation,
      curve: Interval(start, end, curve: Curves.easeOut),
      reverseCurve: Interval(start, end, curve: Curves.easeIn),
    );
    return AnimatedBuilder(
      animation: curved,
      child: child,
      builder: (context, child) {
        return Opacity(
          opacity: curved.value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - curved.value)),
            child: child,
          ),
        );
      },
    );
  }
}

/// Poppins, limited to the three brand colors, for the revealed screen.
ThemeData revealTheme(BuildContext context) {
  final base = Theme.of(context);
  final text = base.textTheme.apply(
    fontFamily: 'Poppins',
    bodyColor: _navy,
    displayColor: _navy,
  );
  return base.copyWith(
    textTheme: text,
    primaryTextTheme: text,
    scaffoldBackgroundColor: _white,
    colorScheme: base.colorScheme.copyWith(
      primary: _navy,
      onPrimary: _white,
      secondary: _teal,
      surface: _white,
      onSurface: _navy,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: _white,
      foregroundColor: _navy,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontFamily: 'Poppins',
        fontWeight: FontWeight.w700,
        fontSize: 20,
        color: _navy,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: _navy,
        foregroundColor: _white,
        textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    inputDecorationTheme: base.inputDecorationTheme.copyWith(
      labelStyle: const TextStyle(fontFamily: 'Poppins', color: _navy),
      floatingLabelStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, color: _navy),
    ),
  );
}
