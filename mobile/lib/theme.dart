import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

const navy = Color(0xFF0B1F3A);
const teal = Color(0xFF14B8A6);
const white = Color(0xFFFFFFFF);
const canvas = Color(0xFFF7F1E8);
const muted = Color(0xFF5B6B7C);

final moneyFormat = NumberFormat.decimalPattern();

String rwf(int amount) => '${moneyFormat.format(amount)} RWF';

String friendlyWhen(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '';
  return DateFormat('dd MMM yyyy · HH:mm').format(parsed.toLocal());
}

String greetingForNow() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

String firstNameOf(String? name) {
  if (name == null || name.trim().isEmpty) return '';
  return name.trim().split(RegExp(r'\s+')).first;
}

String friendlyRole(String role) {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return 'Student registration';
    case 'CASHIER':
      return 'Canteen';
    default:
      return role;
  }
}

String friendlyEvent(String type) {
  switch (type.toUpperCase()) {
    case 'PURCHASE':
      return 'Meal';
    case 'CANTEEN_WITHDRAWAL':
      return 'Withdrawal';
    case 'REVERSAL':
      return 'Refund';
    case 'TEST_CREDIT':
    case 'WALLET_CREDIT':
    case 'CREDIT':
      return 'Top-up';
    case 'FINGERPRINT':
      return 'Fingerprint';
    default:
      final cleaned = type.replaceAll('_', ' ').toLowerCase();
      if (cleaned.isEmpty) return type;
      return '${cleaned[0].toUpperCase()}${cleaned.substring(1)}';
  }
}

String friendlyStatus(String status) {
  switch (status.toUpperCase()) {
    case 'POSTED':
      return 'Completed';
    case 'REVERSED':
      return 'Refunded';
    case 'ACTIVE':
      return 'Active';
    case 'BLOCKED':
      return 'Blocked';
    case 'INACTIVE':
    case 'DEACTIVATED':
      return 'Inactive';
    default:
      return status;
  }
}

ThemeData ekofiTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: teal,
    onPrimary: white,
    secondary: navy,
    onSecondary: white,
    error: Color(0xFFB42318),
    onError: white,
    surface: white,
    onSurface: navy,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: Colors.transparent,
    useMaterial3: true,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: navy,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: navy,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: white.withValues(alpha: 0.78),
      elevation: 0,
      shadowColor: navy.withValues(alpha: 0.04),
      indicatorColor: teal.withValues(alpha: 0.16),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? teal : muted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? teal : muted, size: 24);
      }),
    ),
    cardTheme: CardThemeData(
      color: white.withValues(alpha: 0.62),
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: navy.withValues(alpha: 0.06)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: teal,
        foregroundColor: white,
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: navy,
        minimumSize: const Size.fromHeight(48),
        side: BorderSide(color: navy.withValues(alpha: 0.12)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: teal),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: teal,
      foregroundColor: white,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: white.withValues(alpha: 0.55),
      labelStyle: const TextStyle(color: muted),
      hintStyle: TextStyle(color: muted.withValues(alpha: 0.8)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: navy.withValues(alpha: 0.08)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: navy.withValues(alpha: 0.08)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: teal, width: 1.6),
      ),
    ),
    dividerTheme: DividerThemeData(color: navy.withValues(alpha: 0.08), space: 1),
  );
}
