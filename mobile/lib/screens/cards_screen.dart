import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../nfc/nfc_service.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  final nfc = NfcService();
  List<NfcCard> cards = [];
  List<Student> students = [];
  String? studentId;
  String? scannedUid;
  String? scannedToken;
  bool loading = true;
  bool scanning = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final api = context.read<SessionController>().api;
    try {
      cards = await api.cards();
      students = await api.students(status: 'ACTIVE');
      studentId ??= students.firstOrNull?.id;
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _scan() async {
    setState(() => scanning = true);
    try {
      final card = await nfc.scan(iosMessage: 'Hold the student card near this phone');
      setState(() {
        scannedUid = card.uid;
        scannedToken = card.authToken;
      });
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> _register({String? replaceId}) async {
    if (studentId == null || scannedUid == null) {
      showError(context, 'Hold a card near the phone, then choose a student.');
      return;
    }
    final api = context.read<SessionController>().api;
    try {
      final result = replaceId == null
          ? await api.registerCard(
              studentId: studentId!,
              cardUid: scannedUid!,
              authToken: scannedToken,
            )
          : await api.replaceCard(
              cardId: replaceId,
              studentId: studentId!,
              cardUid: scannedUid!,
              authToken: scannedToken,
            );
      if (result.writeToCard) {
        if (!mounted) return;
        await showInfo(
          context,
          'Finish assigning',
          'Hold the same card near the phone once more so it can be used for meals.',
        );
        await nfc.writeToken(result.authToken);
      }
      if (mounted) {
        await showInfo(context, 'Card ready', result.message);
        await _load();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Student cards')),
      body: loading
          ? const LoadingView()
          : RefreshIndicator(
              color: teal,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (error != null) ErrorBanner(message: error!),
                  const Text(
                    'Each student uses a card to pay at the canteen. Assign a card once, then meals can be taken with a tap.',
                    style: TextStyle(color: muted, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  if (admin) ...[
                    DropdownButtonFormField<String>(
                      initialValue: studentId,
                      decoration: const InputDecoration(labelText: 'Student'),
                      items: students
                          .map(
                            (s) => DropdownMenuItem(
                              value: s.id,
                              child: Text('${s.fullName} · ${s.studentCode}'),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => studentId = value),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: scanning ? null : _scan,
                      icon: const Icon(Icons.contactless),
                      label: Text(scanning ? 'Waiting for card…' : 'Hold card near phone'),
                    ),
                    if (scannedUid != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        scannedToken == null
                            ? 'Card found. It still needs to be assigned.'
                            : 'Card found and ready to assign.',
                        style: const TextStyle(color: navy, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _register,
                        child: const Text('Assign to student'),
                      ),
                    ],
                    const SizedBox(height: 20),
                  ],
                  if (cards.isEmpty)
                    const EmptyState(
                      icon: Icons.contactless_outlined,
                      title: 'No cards yet',
                      message: 'Assign a card to a student to start taking meal payments.',
                    )
                  else
                    ...cards.map(
                      (card) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
                            leading: InitialsAvatar(name: card.student?.fullName ?? 'Card'),
                            title: Text(
                              card.student?.fullName ?? 'Unassigned card',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              friendlyStatus(card.status),
                              style: const TextStyle(color: muted),
                            ),
                            trailing: admin && card.isActive
                                ? TextButton(
                                    onPressed: () async {
                                      try {
                                        await context.read<SessionController>().api.blockCard(
                                          card.id,
                                          'Lost or stolen',
                                        );
                                        _load();
                                      } on ApiException catch (e) {
                                        if (context.mounted) showError(context, e);
                                      }
                                    },
                                    child: const Text('Block'),
                                  )
                                : admin && !card.isActive
                                ? TextButton(
                                    onPressed: () async {
                                      studentId = card.studentId;
                                      await _scan();
                                      await _register(replaceId: card.id);
                                    },
                                    child: const Text('Replace'),
                                  )
                                : StatusChip(label: card.status, ok: card.isActive),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
