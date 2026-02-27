import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/expense.dart';

class ExpenseCard extends StatelessWidget {
  final Expense expense;
  final VoidCallback? onTap;

  const ExpenseCard({
    super.key,
    required this.expense,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: description and amount
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Category icon
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _categoryColor(expense.category).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _categoryIcon(expense.category),
                      size: 20,
                      color: _categoryColor(expense.category),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Description and date
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          expense.description,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('MMM d, yyyy').format(expense.expenseDate),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                  // Amount
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${expense.amount.toStringAsFixed(2)} ${expense.currency}',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 4),
                      _StatusBadge(status: expense.status),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Bottom row: category, cost center, project code
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _buildTag(context, expense.category),
                  if (expense.costCenter.isNotEmpty)
                    _buildTag(context, expense.costCenter),
                  if (expense.projectCode.isNotEmpty)
                    _buildTag(context, expense.projectCode),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTag(BuildContext context, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
    );
  }

  static IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'travel':
        return Icons.flight;
      case 'accommodation':
        return Icons.hotel;
      case 'meals':
        return Icons.restaurant;
      case 'transportation':
        return Icons.directions_car;
      case 'office':
        return Icons.business_center;
      default:
        return Icons.receipt_long;
    }
  }

  static Color _categoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'travel':
        return Colors.blue;
      case 'accommodation':
        return Colors.purple;
      case 'meals':
        return Colors.orange;
      case 'transportation':
        return Colors.teal;
      case 'office':
        return Colors.indigo;
      default:
        return Colors.grey;
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color backgroundColor;
    Color textColor;

    switch (status) {
      case 'DRAFT':
        backgroundColor = Colors.grey.shade200;
        textColor = Colors.grey.shade700;
        break;
      case 'SUBMITTED':
        backgroundColor = Colors.orange.shade100;
        textColor = Colors.orange.shade800;
        break;
      case 'MANAGER_APPROVED':
        backgroundColor = Colors.blue.shade100;
        textColor = Colors.blue.shade800;
        break;
      case 'FINANCE_APPROVED':
        backgroundColor = Colors.green.shade100;
        textColor = Colors.green.shade800;
        break;
      case 'REJECTED':
        backgroundColor = Colors.red.shade100;
        textColor = Colors.red.shade800;
        break;
      case 'POSTED_TO_SAP':
        backgroundColor = Colors.teal.shade100;
        textColor = Colors.teal.shade800;
        break;
      default:
        backgroundColor = Colors.grey.shade200;
        textColor = Colors.grey.shade700;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _formatStatus(status),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  static String _formatStatus(String status) {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'SUBMITTED':
        return 'Submitted';
      case 'MANAGER_APPROVED':
        return 'Manager Approved';
      case 'FINANCE_APPROVED':
        return 'Finance Approved';
      case 'REJECTED':
        return 'Rejected';
      case 'POSTED_TO_SAP':
        return 'Posted to SAP';
      default:
        return status;
    }
  }
}
