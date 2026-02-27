import 'package:flutter/material.dart';
import '../models/expense.dart';
import '../services/api_service.dart';
import '../widgets/expense_card.dart';

class ExpenseListScreen extends StatefulWidget {
  const ExpenseListScreen({super.key});

  @override
  State<ExpenseListScreen> createState() => _ExpenseListScreenState();
}

class _ExpenseListScreenState extends State<ExpenseListScreen> {
  final ApiService _api = ApiService();
  List<Expense> _expenses = [];
  bool _loading = true;
  String? _error;
  String _selectedFilter = 'all';

  final Map<String, String> _filters = {
    'all': 'All',
    'DRAFT': 'Draft',
    'SUBMITTED': 'Submitted',
    'MANAGER_APPROVED': 'Manager Approved',
    'FINANCE_APPROVED': 'Finance Approved',
    'REJECTED': 'Rejected',
    'POSTED_TO_SAP': 'Posted to SAP',
  };

  @override
  void initState() {
    super.initState();
    _loadExpenses();
  }

  Future<void> _loadExpenses() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final status = _selectedFilter == 'all' ? null : _selectedFilter;
      _expenses = await _api.getExpenses(status: status, limit: 100);
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load expenses.';
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expenses'),
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: _filters.entries.map((entry) {
                final isSelected = _selectedFilter == entry.key;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(entry.value),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() => _selectedFilter = entry.key);
                      _loadExpenses();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1),

          // Expense list
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadExpenses,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? _buildErrorView()
                      : _expenses.isEmpty
                          ? _buildEmptyView()
                          : _buildExpenseList(),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.of(context).pushNamed('/expenses/new');
          if (result == true) _loadExpenses();
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48,
                color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _loadExpenses,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 64,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              _selectedFilter == 'all'
                  ? 'No expenses found'
                  : 'No ${_filters[_selectedFilter]} expenses',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Tap + to create a new expense',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpenseList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _expenses.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ExpenseCard(
            expense: _expenses[index],
            onTap: () async {
              final result = await Navigator.of(context).pushNamed(
                '/expenses/edit',
                arguments: _expenses[index],
              );
              if (result == true) _loadExpenses();
            },
          ),
        );
      },
    );
  }
}
