import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/expense.dart';
import '../services/api_service.dart';
import '../widgets/expense_card.dart';
import '../providers/locale_provider.dart';
import '../providers/theme_provider.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

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
  bool _isOffline = false;

  // Filtre etiketleri build() içinde l10n ile doldurulur
  Map<String, String> _getFilters(AppLocalizations? l10n) => {
    'all': l10n?.all ?? 'All',
    'DRAFT': l10n?.draft ?? 'Draft',
    'SUBMITTED': l10n?.submitted ?? 'Submitted',
    'MANAGER_APPROVED': l10n?.managerApproved ?? 'Manager Approved',
    'FINANCE_APPROVED': l10n?.financeApproved ?? 'Finance Approved',
    'REJECTED': l10n?.rejected ?? 'Rejected',
    'POSTED_TO_SAP': l10n?.postedToSap ?? 'Posted to SAP',
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

    final connectivity = await Connectivity().checkConnectivity();
    final offline = !connectivity.any((r) => r != ConnectivityResult.none);
    setState(() => _isOffline = offline);

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

  Future<void> _deleteExpense(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(AppLocalizations.of(context)?.deleteExpense ?? 'Delete Expense'),
        content: Text(AppLocalizations.of(context)?.deleteExpenseConfirm ?? 'Are you sure you want to delete this expense?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(AppLocalizations.of(context)?.cancel ?? 'Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            child: Text(AppLocalizations.of(context)?.delete ?? 'Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.deleteExpense(id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(AppLocalizations.of(context)?.expenseDeleted ?? 'Expense deleted')),
          );
        }
        _loadExpenses();
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message), backgroundColor: Theme.of(context).colorScheme.error),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final localeProvider = context.watch<LocaleProvider>();
    final l10n = AppLocalizations.of(context);
    final filters = _getFilters(l10n);

    // Compute duplicates
    final counts = <String, int>{};
    for (var e in _expenses) {
      final key = '${e.description}_${e.amount}_${DateFormat('yyyy-MM-dd').format(e.expenseDate)}';
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.expenses ?? 'Expenses'),
        actions: [
          TextButton(
            onPressed: () => localeProvider.toggle(),
            style: TextButton.styleFrom(
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.language, size: 16),
                const SizedBox(width: 4),
                Text(
                  localeProvider.isTurkish ? 'TR' : 'EN',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(themeProvider.themeMode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode),
            tooltip: themeProvider.themeMode == ThemeMode.dark ? (l10n?.lightMode ?? 'Light Mode') : (l10n?.darkMode ?? 'Dark Mode'),
            onPressed: () => themeProvider.toggle(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 56,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: filters.entries.map((entry) {
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

          // Offline banner
          if (_isOffline)
            Container(
              width: double.infinity,
              color: Colors.orange.shade100,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Icon(Icons.wifi_off, size: 16, color: Colors.orange.shade800),
                  const SizedBox(width: 8),
                  Text(
                    'You are offline. Showing cached data.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.orange.shade900,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
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
                          : _buildExpenseList(counts),
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
    final l10n = AppLocalizations.of(context);
    final filters = _getFilters(l10n);
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
                  ? (l10n?.noData ?? 'No expenses found')
                  : 'No ${filters[_selectedFilter]} expenses',
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

  Widget _buildExpenseList(Map<String, int> counts) {
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _expenses.length,
      itemBuilder: (context, index) {
        final expense = _expenses[index];
        final key = '${expense.description}_${expense.amount}_${DateFormat('yyyy-MM-dd').format(expense.expenseDate)}';
        final isDuplicate = (counts[key] ?? 0) > 1;

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ExpenseCard(
            expense: expense,
            isDuplicate: isDuplicate,
            onDelete: (expense.isDraft || expense.isSubmitted || expense.isRejected) ? () => _deleteExpense(expense.id) : null,
            onTap: () async {
              final result = await Navigator.of(context).pushNamed(
                '/expenses/edit',
                arguments: expense,
              );
              if (result == true) _loadExpenses();
            },
          ),
        );
      },
    );
  }
}
