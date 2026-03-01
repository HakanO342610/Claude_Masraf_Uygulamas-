import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../models/expense.dart';
import '../services/api_service.dart';

  String _translateCategory(AppLocalizations? l10n, String category) {
    if (l10n == null) return category;
    switch (category) {
      case 'Travel': return l10n.catTravel ?? category;
      case 'Accommodation': return l10n.catAccommodation ?? category;
      case 'Meals': return l10n.catMeals ?? category;
      case 'Transportation': return l10n.catTransportation ?? category;
      case 'Office': return l10n.catOffice ?? category;
      case 'Other': return l10n.catOther ?? category;
      case 'Food & Beverage': return l10n.catFoodBeverage ?? category;
      case 'Office Supplies': return l10n.catOfficeSupplies ?? category;
      default: return category;
    }
  }

class ApprovalScreen extends StatefulWidget {
  const ApprovalScreen({super.key});

  @override
  State<ApprovalScreen> createState() => _ApprovalScreenState();
}

class _ApprovalScreenState extends State<ApprovalScreen> {
  final ApiService _api = ApiService();
  List<Expense> _pendingExpenses = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPendingExpenses();
  }

  Future<void> _loadPendingExpenses() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _pendingExpenses = await _api.getPendingApprovals();
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load pending approvals.';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approveExpense(Expense expense) async {
    try {
      await _api.approveExpense(expense.id);
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n?.expenseApproved ?? 'Expense approved successfully'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        _loadPendingExpenses();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: Theme.of(context).colorScheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _rejectExpense(Expense expense) async {
    final reasonController = TextEditingController();
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n?.rejectExpenseTitle ?? 'Reject Expense'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${l10n?.reject ?? 'Reject'} ${expense.amount.toStringAsFixed(2)} ${expense.currency}?'),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: l10n?.rejectReason ?? 'Reason (optional)',
                hintText: l10n?.rejectHint ?? 'Enter rejection reason...',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n?.cancel ?? 'Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(l10n?.reject ?? 'Reject'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final reason = reasonController.text.trim();
        await _api.rejectExpense(expense.id, reason: reason.isNotEmpty ? reason : null);
        if (mounted) {
          final l10n2 = AppLocalizations.of(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n2?.expenseRejected ?? 'Expense rejected'),
              behavior: SnackBarBehavior.floating,
            ),
          );
          _loadPendingExpenses();
        }
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.message),
              backgroundColor: Theme.of(context).colorScheme.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
    reasonController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.approvals ?? 'Approvals'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadPendingExpenses,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadPendingExpenses,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildErrorView(l10n)
                : _pendingExpenses.isEmpty
                    ? _buildEmptyView(l10n)
                    : _buildApprovalList(l10n),
      ),
    );
  }

  Widget _buildErrorView(AppLocalizations? l10n) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _loadPendingExpenses,
              child: Text(l10n?.retry ?? 'Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyView(AppLocalizations? l10n) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, size: 64, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              l10n?.allCaughtUp ?? 'All caught up!',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              l10n?.noPendingApprovals ?? 'No pending expenses to approve',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApprovalList(AppLocalizations? l10n) {
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _pendingExpenses.length,
      itemBuilder: (context, index) {
        final expense = _pendingExpenses[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        expense.description,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${expense.amount.toStringAsFixed(2)} ${expense.currency}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 16,
                  runSpacing: 4,
                  children: [
                    _buildDetailChip(Icons.calendar_today, DateFormat('MMM d, yyyy').format(expense.expenseDate)),
                    _buildDetailChip(Icons.category_outlined, _translateCategory(l10n, expense.category)),
                    _buildDetailChip(Icons.business_outlined, expense.costCenter),
                    _buildDetailChip(Icons.folder_outlined, expense.projectCode),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _rejectExpense(expense),
                      icon: const Icon(Icons.close, size: 18),
                      label: Text(l10n?.reject ?? 'Reject'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.error,
                        side: BorderSide(color: Theme.of(context).colorScheme.error),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: () => _approveExpense(expense),
                      icon: const Icon(Icons.check, size: 18),
                      label: Text(l10n?.approve ?? 'Approve'),
                      style: FilledButton.styleFrom(backgroundColor: Colors.green),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}
