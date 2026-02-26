import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/expense.dart';
import '../services/api_service.dart';

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
      _pendingExpenses = await _api.getExpenses(status: 'pending', limit: 100);
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Expense approved successfully'),
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
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject Expense'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Reject expense of ${expense.amount.toStringAsFixed(2)} ${expense.currency}?',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                hintText: 'Enter rejection reason...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final reason = reasonController.text.trim();
        await _api.rejectExpense(
          expense.id,
          reason: reason.isNotEmpty ? reason : null,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Expense rejected'),
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approvals'),
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
                ? _buildErrorView()
                : _pendingExpenses.isEmpty
                    ? _buildEmptyView()
                    : _buildApprovalList(),
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
              onPressed: _loadPendingExpenses,
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
            Icon(Icons.check_circle_outline, size: 64,
                color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              'All caught up!',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'No pending expenses to approve',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApprovalList() {
    return ListView.builder(
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
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        expense.description,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
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

                // Details
                Wrap(
                  spacing: 16,
                  runSpacing: 4,
                  children: [
                    _buildDetailChip(
                      Icons.calendar_today,
                      DateFormat('MMM d, yyyy').format(expense.expenseDate),
                    ),
                    _buildDetailChip(Icons.category_outlined, expense.category),
                    _buildDetailChip(
                        Icons.business_outlined, expense.costCenter),
                    _buildDetailChip(
                        Icons.folder_outlined, expense.projectCode),
                  ],
                ),
                const SizedBox(height: 16),

                // Action buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _rejectExpense(expense),
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text('Reject'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.error,
                        side: BorderSide(
                            color: Theme.of(context).colorScheme.error),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: () => _approveExpense(expense),
                      icon: const Icon(Icons.check, size: 18),
                      label: const Text('Approve'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green,
                      ),
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
        Icon(icon, size: 14,
            color: Theme.of(context).colorScheme.onSurfaceVariant),
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
