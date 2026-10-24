import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 56});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/branding/logo.png',
      height: height,
      fit: BoxFit.contain,
      alignment: Alignment.center,
      filterQuality: FilterQuality.high,
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.asset(
        'assets/branding/app_icon.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
      ),
    );
  }
}

class BrandWatermark extends StatelessWidget {
  const BrandWatermark({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          Positioned(top: -28, right: -36, child: _blob(220, teal.withValues(alpha: 0.14))),
          Positioned(top: 120, left: -80, child: _blob(180, const Color(0xFFE8C39E).withValues(alpha: 0.22))),
          Positioned(bottom: 40, right: -40, child: _blob(160, teal.withValues(alpha: 0.10))),
          Positioned(top: 72, right: 18, child: _mark(132, 0.055, -16)),
          Positioned(bottom: 120, left: -24, child: _mark(96, 0.04, 12)),
        ],
      ),
    );
  }

  Widget _blob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }

  Widget _mark(double size, double opacity, double angle) {
    return Opacity(
      opacity: opacity,
      child: Transform.rotate(
        angle: angle * 3.14159 / 180,
        child: Image.asset(
          'assets/branding/logo.png',
          width: size,
          height: size,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}

class AppGridBackground extends StatefulWidget {
  const AppGridBackground({super.key, this.lively = false});

  final bool lively;

  @override
  State<AppGridBackground> createState() => _AppGridBackgroundState();
}

class _AppGridBackgroundState extends State<AppGridBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 14))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _GridPainter(t: _controller.value, lively: widget.lively),
          child: const SizedBox.expand(),
        );
      },
    );
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter({required this.t, required this.lively});

  final double t;
  final bool lively;

  @override
  void paint(Canvas canvas, Size size) {
    final shift = Offset((t * 56) - 28, (t * 40) - 20);
    final paint = Paint()
      ..color = navy.withValues(alpha: lively ? 0.07 : 0.035)
      ..strokeWidth = 1;
    const step = 28.0;
    for (double x = -step + shift.dx % step; x <= size.width + step; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = -step + shift.dy % step; y <= size.height + step; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    if (!lively) return;
    final spark = Paint()..color = teal.withValues(alpha: 0.16);
    for (var i = 0; i < 6; i++) {
      final px = (size.width * ((0.12 * i + t * (i.isEven ? 0.35 : 0.22)) % 1));
      final py = (size.height * ((0.18 * i + t * (i.isOdd ? 0.4 : 0.15)) % 1));
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(px, py), width: 22, height: 22), const Radius.circular(6)),
        spark,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GridPainter oldDelegate) => oldDelegate.t != t || oldDelegate.lively != lively;
}

Future<void> showPaymentBurst(
  BuildContext context, {
  required bool ok,
  required String title,
  required String message,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Payment result',
    barrierColor: (ok ? teal : const Color(0xFFB42318)).withValues(alpha: 0.92),
    transitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (context, animation, secondary) {
      return Center(
        child: ScaleTransition(
          scale: CurvedAnimation(parent: animation, curve: Curves.elasticOut),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
                  color: white,
                  size: 128,
                ),
                const SizedBox(height: 18),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: white,
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: white, fontSize: 18, height: 1.4),
                ),
                const SizedBox(height: 28),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: white, foregroundColor: ok ? teal : const Color(0xFFB42318)),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Continue'),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.size = 44});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.isEmpty
        ? 'E'
        : parts.take(2).map((p) => p[0].toUpperCase()).join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: teal.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Text(
        initials,
        style: TextStyle(
          color: navy,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.34,
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.ok});

  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: ok ? teal.withValues(alpha: 0.14) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        friendlyStatus(label),
        style: TextStyle(
          color: ok ? navy : const Color(0xFF991B1B),
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(message, style: const TextStyle(color: Color(0xFF991B1B), height: 1.35)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: teal),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: navy)),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: muted, height: 1.4)),
          ],
        ),
      ),
    );
  }
}

class MagicNavItem {
  const MagicNavItem({required this.icon, required this.selectedIcon, required this.label});

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

class MagicNavBar extends StatelessWidget {
  const MagicNavBar({
    super.key,
    required this.index,
    required this.items,
    required this.onChanged,
  });

  final int index;
  final List<MagicNavItem> items;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: Container(
          height: 72,
          decoration: BoxDecoration(
            color: navy,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(color: navy.withValues(alpha: 0.28), blurRadius: 24, offset: const Offset(0, 10)),
            ],
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final slot = constraints.maxWidth / items.length;
              return Stack(
                children: [
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 480),
                    curve: Curves.elasticOut,
                    left: slot * index + 8,
                    top: 8,
                    bottom: 8,
                    width: slot - 16,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: teal,
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < items.length; i++)
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              onChanged(i);
                            },
                            borderRadius: BorderRadius.circular(20),
                            child: _MagicNavButton(item: items[i], selected: i == index),
                          ),
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _MagicNavButton extends StatelessWidget {
  const _MagicNavButton({required this.item, required this.selected});

  final MagicNavItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: selected ? 1.08 : 1,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutBack,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: Icon(
              selected ? item.selectedIcon : item.icon,
              key: ValueKey('${item.label}-$selected'),
              color: white,
              size: selected ? 24 : 22,
            ),
          ),
          const SizedBox(height: 4),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 220),
            style: TextStyle(
              color: white.withValues(alpha: selected ? 1 : 0.72),
              fontSize: 11,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            ),
            child: Text(item.label),
          ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator(color: teal));
  }
}

Future<void> showError(BuildContext context, Object error) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Something went wrong'),
      content: Text('$error'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
      ],
    ),
  );
}

Future<void> showInfo(BuildContext context, String title, String message) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
      ],
    ),
  );
}
