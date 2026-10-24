import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  List<LedgerEvent> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      items = await context.read<SessionController>().api.transactions();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paid')),
      body: loading
          ? const LoadingView()
          : items.isEmpty
          ? const EmptyState(
              icon: Icons.receipt_long_outlined,
              title: 'No payments yet',
              message: 'Meal payments and refunds will appear here.',
            )
          : RefreshIndicator(
              color: teal,
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final event = items[i];
                  return Card(
                    child: ListTile(
                      leading: InitialsAvatar(name: event.student?.fullName ?? friendlyEvent(event.type)),
                      title: Text(
                        event.student?.studentCode.isNotEmpty == true
                            ? event.student!.studentCode
                            : (event.student?.fullName ?? friendlyEvent(event.type)),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        [
                          if (event.student?.fullName.isNotEmpty == true) event.student!.fullName,
                          friendlyEvent(event.type),
                          if (event.canteenName != null && event.canteenName!.isNotEmpty) event.canteenName,
                          if (friendlyWhen(event.createdAt).isNotEmpty) friendlyWhen(event.createdAt),
                        ].join(' · '),
                        style: const TextStyle(color: muted),
                      ),
                      isThreeLine: true,
                      trailing: Text(rwf(event.amountRwf), style: const TextStyle(fontWeight: FontWeight.w700)),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TransactionDetailScreen(eventId: event.id),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

class TransactionDetailScreen extends StatefulWidget {
  const TransactionDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<TransactionDetailScreen> createState() => _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends State<TransactionDetailScreen> {
  LedgerEvent? event;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    event = await context.read<SessionController>().api.transaction(widget.eventId);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final canteen = context.watch<SessionController>().isCanteen;
    final event = this.event;
    return Scaffold(
      appBar: AppBar(title: Text(event == null ? 'Payment' : friendlyEvent(event.type))),
      body: event == null
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StatusChip(label: event.status, ok: event.status == 'POSTED'),
                        const SizedBox(height: 12),
                        Text(
                          rwf(event.amountRwf),
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: navy),
                        ),
                        if (event.student != null)
                          Text(
                            [
                              if (event.student!.studentCode.isNotEmpty) event.student!.studentCode,
                              event.student!.fullName,
                            ].join(' · '),
                            style: const TextStyle(color: muted),
                          ),
                        if (event.description != null) ...[
                          const SizedBox(height: 8),
                          Text(event.description!),
                        ],
                      ],
                    ),
                  ),
                ),
                if (canteen && event.status == 'POSTED' && event.type != 'REVERSAL') ...[
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: () async {
                      try {
                        await context.read<SessionController>().api.reverse(event.id);
                        _load();
                      } on ApiException catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: const Text('Undo this payment'),
                  ),
                ],
              ],
            ),
    );
  }
}
