import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../services/api_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final ApiService _api = ApiService();
  bool _isLoading = true;
  Map<String, dynamic> _summary = {};
  List<Map<String, dynamic>> _categoryData = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getReportSummary(),
        _api.getReportByCategory(),
      ]);
      setState(() {
        _summary = results[0] as Map<String, dynamic>;
        _categoryData = results[1] as List<Map<String, dynamic>>;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load reports: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatCurrency(dynamic amount) {
    final value = amount is num ? amount.toDouble() : double.tryParse(amount.toString()) ?? 0;
    return '${value.toStringAsFixed(2)} TRY';
  }

  String _translateCategory(AppLocalizations l10n, String category) {
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(l10n?.reports ?? 'Reports')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryCard(
                          title: l10n?.total ?? 'Total',
                          value: _summary['totalExpenses']?.toString() ?? '0',
                          color: colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SummaryCard(
                          title: l10n?.amount ?? 'Amount',
                          value: _formatCurrency(_summary['totalAmount'] ?? 0),
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryCard(
                          title: l10n?.average ?? 'Average',
                          value: _formatCurrency(_summary['averageAmount'] ?? 0),
                          color: Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SummaryCard(
                          title: l10n?.highest ?? 'Highest',
                          value: _formatCurrency(_summary['maxAmount'] ?? 0),
                          color: Colors.orange,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    l10n?.byCategory ?? 'By Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_categoryData.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(l10n?.noDataAvailable ?? 'No data available'),
                      ),
                    )
                  else
                    ..._categoryData.map((item) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(l10n != null ? _translateCategory(l10n, item['category']?.toString() ?? '') : (item['category']?.toString() ?? '')),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${l10n?.expenseCountLabel(item['count'] as int? ?? 0) ?? '${item['count']} expenses'} - ${_formatCurrency(item['totalAmount'] ?? 0)}'),
                                const SizedBox(height: 4),
                                LinearProgressIndicator(
                                  value: ((item['percentage'] as num?)?.toDouble() ?? 0) / 100,
                                  backgroundColor: Colors.grey[200],
                                ),
                              ],
                            ),
                            trailing: Text(
                              '${item['percentage']}%',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                        )),
                ],
              ),
            ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _SummaryCard({required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
