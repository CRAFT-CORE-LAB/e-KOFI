import 'dart:io';
import 'dart:ui';

import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'models.dart';

String _cell(String value) {
  if (value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r')) {
    return '"${value.replaceAll('"', '""')}"';
  }
  return value;
}

String _when(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  return DateFormat('yyyy-MM-dd HH:mm').format(parsed.toLocal());
}

/// Paid meals saved on this phone, used when the server file cannot be reached.
String paidMealsCsvFromEvents(List<LedgerEvent> events) {
  final paid = events
      .where((event) => event.type == 'PURCHASE' && (event.status == 'POSTED' || event.status == 'PENDING_SYNC'))
      .toList()
    ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  final lines = <String>[
    ['Date', 'Student ID', 'Student name', 'Canteen', 'Amount RWF', 'Status', 'Description', 'Recorded by']
        .map(_cell)
        .join(','),
  ];
  var total = 0;
  for (final event in paid) {
    total += event.amountRwf;
    final student = event.student;
    final name = student == null ? '' : student.fullName.trim();
    lines.add(
      [
        _when(event.createdAt),
        student?.studentCode ?? '',
        name,
        event.canteenName ?? '',
        '${event.amountRwf}',
        event.status == 'PENDING_SYNC' ? 'Paid on this phone' : 'Paid',
        event.description ?? '',
        '',
      ].map(_cell).join(','),
    );
  }
  lines.add(['', '', '', 'Total', '$total', '', '', ''].join(','));
  return '${lines.join('\r\n')}\r\n';
}

Future<void> shareCsv(String csv, String filename) async {
  final body = csv.startsWith('\uFEFF') ? csv : '\uFEFF$csv';
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}${Platform.pathSeparator}$filename');
  await file.writeAsString(body, flush: true);
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path, mimeType: 'text/csv', name: filename)],
      subject: 'Paid canteen meals',
      sharePositionOrigin: const Rect.fromLTWH(0, 0, 1, 1),
    ),
  );
}
