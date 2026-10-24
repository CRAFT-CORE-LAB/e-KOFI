import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models.dart';
import '../state/session.dart';
import '../theme.dart';
import '../widgets.dart';

class CanteensScreen extends StatefulWidget {
  const CanteensScreen({super.key});

  @override
  State<CanteensScreen> createState() => _CanteensScreenState();
}

class _CanteensScreenState extends State<CanteensScreen> {
  List<Canteen> items = [];
  List<School> schools = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<SessionController>().api;
    setState(() => loading = true);
    try {
      items = await api.canteens();
      schools = await api.schools();
      error = null;
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    final name = TextEditingController();
    var schoolId = schools.firstOrNull?.id;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add canteen'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: schoolId,
              decoration: const InputDecoration(labelText: 'School'),
              items: schools
                  .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                  .toList(),
              onChanged: (value) => schoolId = value,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (saved != true || schoolId == null || !mounted) return;
    try {
      await context.read<SessionController>().api.createCanteen(name.text.trim(), schoolId!);
      _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<SessionController>().isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Canteens')),
      floatingActionButton: admin
          ? FloatingActionButton.extended(
              onPressed: _create,
              icon: const Icon(Icons.add),
              label: const Text('Add'),
            )
          : null,
      body: loading
          ? const LoadingView()
          : RefreshIndicator(
              color: teal,
              onRefresh: _load,
              child: items.isEmpty
                  ? const EmptyState(
                      icon: Icons.storefront_outlined,
                      title: 'No canteens yet',
                      message: 'Add a counter so staff can take meal payments.',
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                      children: [
                        if (error != null) ErrorBanner(message: error!),
                        ...items.map(
                          (canteen) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Card(
                              child: ListTile(
                                leading: const Icon(Icons.storefront_outlined, color: teal),
                                title: Text(canteen.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                subtitle: Text(canteen.school?.name ?? '', style: const TextStyle(color: muted)),
                                trailing: Text(
                                  rwf(canteen.account?.balanceRwf ?? 0),
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => CanteenDetailScreen(canteenId: canteen.id),
                                  ),
                                ),
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

class CanteenDetailScreen extends StatefulWidget {
  const CanteenDetailScreen({super.key, required this.canteenId});

  final String canteenId;

  @override
  State<CanteenDetailScreen> createState() => _CanteenDetailScreenState();
}

class _CanteenDetailScreenState extends State<CanteenDetailScreen> {
  Canteen? canteen;

  @override
  void initState() {
    super.initState();
    context.read<SessionController>().api.canteen(widget.canteenId).then((value) {
      if (mounted) setState(() => canteen = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final canteen = this.canteen;
    return Scaffold(
      appBar: AppBar(title: Text(canteen?.name ?? 'Canteen')),
      body: canteen == null
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
                        const Text('Today’s total', style: TextStyle(color: muted)),
                        Text(
                          rwf(canteen.account?.balanceRwf ?? 0),
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: navy),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text('Recent meals', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: navy)),
                const SizedBox(height: 8),
                if (canteen.history.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'No meals yet',
                    message: 'Payments taken at this counter will appear here.',
                  )
                else
                  ...canteen.history.map(
                    (event) => Card(
                      child: ListTile(
                        title: Text(event.student?.fullName ?? friendlyEvent(event.type)),
                        subtitle: Text(friendlyEvent(event.type), style: const TextStyle(color: muted)),
                        trailing: Text(rwf(event.amountRwf), style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
