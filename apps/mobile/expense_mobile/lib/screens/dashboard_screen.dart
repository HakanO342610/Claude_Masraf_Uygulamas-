import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/expense.dart';
import '../providers/locale_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../widgets/expense_card.dart';
import '../widgets/summary_card.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiService _api = ApiService();
  List<Expense> _recentExpenses = [];
  bool _loading = true;
  String? _error;
  int _currentIndex = 0;

  int _totalCount = 0;
  int _pendingCount = 0;
  int _approvedCount = 0;
  int _rejectedCount = 0;
  double _totalAmount = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final expenses = await _api.getExpenses(limit: 50);
      _recentExpenses = expenses.take(10).toList();
      _totalCount = expenses.length;
      _pendingCount = expenses.where((e) => e.isPending).length;
      _approvedCount = expenses.where((e) => e.isApproved).length;
      _rejectedCount = expenses.where((e) => e.isRejected).length;
      _totalAmount = expenses.fold(0.0, (sum, e) => sum + e.amount);
    } on ApiException catch (e) {
      _error = e.message;
      if (e.statusCode == 401) {
        if (mounted) Navigator.of(context).pushReplacementNamed('/login');
        return;
      }
    } catch (e) {
      _error = 'Failed to load data. Pull to refresh.';
    }

    if (mounted) setState(() => _loading = false);
  }

  void _onTabTapped(int index, bool canApprove) async {
    if (index == 0) {
      _loadData(); // Refresh dashboard when tapping dashboard tab
      return;
    }
    
    final routes = ['/', '/expenses', '/receipts'];
    if (canApprove) {
      routes.add('/reports');
      routes.add('/approvals');
    }
    final authService = context.read<AuthService>();
    if (authService.user?.isAdmin == true) {
      routes.add('/users');
    }
    
    if (index < routes.length) {
      await Navigator.of(context).pushNamed(routes[index]);
      // Reload data when returning from any screen
      _loadData();
      if (mounted) setState(() => _currentIndex = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final user = authService.user;
    final themeProvider = context.watch<ThemeProvider>();
    final localeProvider = context.watch<LocaleProvider>();
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.dashboard ?? 'Dashboard'),
        actions: [
          // Dil toggle
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
          // Dark mode toggle
          IconButton(
            icon: Icon(themeProvider.themeMode == ThemeMode.dark
                ? Icons.light_mode
                : Icons.dark_mode),
            tooltip: themeProvider.themeMode == ThemeMode.dark ? (l10n?.lightMode ?? 'Açık Mod') : (l10n?.darkMode ?? 'Koyu Mod'),
            onPressed: () => themeProvider.toggle(),
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              radius: 16,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                (user?.name.isNotEmpty == true)
                    ? user!.name[0].toUpperCase()
                    : 'U',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            onSelected: (value) async {
              if (value == 'logout') {
                await authService.logout();
                if (mounted) {
                  Navigator.of(context).pushReplacementNamed('/login');
                }
              } else if (value == 'theme') {
                themeProvider.toggle();
              } else if (value == 'language') {
                localeProvider.toggle();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? 'User',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text(user?.email ?? '',
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'language',
                child: Row(
                  children: [
                    const Icon(Icons.language, size: 20),
                    const SizedBox(width: 8),
                    Text(l10n?.language ?? 'Language'),
                    const Spacer(),
                    Text(localeProvider.isTurkish ? 'TR' : 'EN', 
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'theme',
                child: Row(
                  children: [
                    Icon(themeProvider.themeMode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode, size: 20),
                    const SizedBox(width: 8),
                    Text(themeProvider.themeMode == ThemeMode.dark ? (l10n?.lightMode ?? 'Açık Mod') : (l10n?.darkMode ?? 'Koyu Mod')),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    const Icon(Icons.logout, size: 20),
                    const SizedBox(width: 8),
                    Text(l10n?.logout ?? 'Sign Out'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildErrorView()
                : _buildDashboardContent(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
          _onTabTapped(index, user?.canApprove ?? false);
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.dashboard_outlined),
            selectedIcon: const Icon(Icons.dashboard),
            label: l10n?.dashboard ?? 'Dashboard',
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long),
            label: l10n?.expenses ?? 'Expenses',
          ),
          NavigationDestination(
            icon: const Icon(Icons.camera_alt_outlined),
            selectedIcon: const Icon(Icons.camera_alt),
            label: l10n?.receipts ?? 'Receipts',
          ),
          if (user?.canApprove == true)
            NavigationDestination(
              icon: const Icon(Icons.bar_chart_outlined),
              selectedIcon: const Icon(Icons.bar_chart),
              label: l10n?.reports ?? 'Reports',
            ),
          if (user?.canApprove == true)
            NavigationDestination(
              icon: const Icon(Icons.approval_outlined),
              selectedIcon: const Icon(Icons.approval),
              label: l10n?.approvals ?? 'Approvals',
            ),
          if (user?.isAdmin == true)
            NavigationDestination(
              icon: const Icon(Icons.people_outline),
              selectedIcon: const Icon(Icons.people),
              label: l10n?.users ?? 'Users',
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.of(context).pushNamed('/expenses/new');
          if (result == true) _loadData();
        },
        icon: const Icon(Icons.add),
        label: Text(l10n?.newExpense ?? 'New Expense'),
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
            Icon(Icons.cloud_off, size: 64,
                color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _loadData,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboardContent() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        // Greeting
        Text(
          'Welcome back, ${context.read<AuthService>().user?.name.split(' ').first ?? 'User'}',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Here is your expense summary',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 20),

        // Summary cards
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            SummaryCard(
              title: l10n?.totalExpenses ?? 'Total',
              value: _totalCount.toString(),
              icon: Icons.receipt_long,
              color: Theme.of(context).colorScheme.primary,
            ),
            SummaryCard(
              title: l10n?.pendingApprovals ?? 'Pending',
              value: _pendingCount.toString(),
              icon: Icons.hourglass_empty,
              color: Colors.orange,
            ),
            SummaryCard(
              title: l10n?.approved ?? 'Approved',
              value: _approvedCount.toString(),
              icon: Icons.check_circle_outline,
              color: Colors.green,
            ),
            SummaryCard(
              title: l10n?.rejected ?? 'Rejected',
              value: _rejectedCount.toString(),
              icon: Icons.cancel_outlined,
              color: Colors.red,
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Total amount card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.currency_lira,
                      color: Theme.of(context).colorScheme.onPrimaryContainer),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Total Expenses',
                          style: Theme.of(context).textTheme.bodyMedium),
                      Text(
                        '${_totalAmount.toStringAsFixed(2)} TRY',
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Recent expenses
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Expenses',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pushNamed('/expenses'),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (_recentExpenses.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.receipt_long_outlined,
                      size: 48,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(height: 8),
                  Text(
                    'No expenses yet',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap the + button to add your first expense',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          )
        else
          ...List.generate(
            _recentExpenses.length,
            (index) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ExpenseCard(
                expense: _recentExpenses[index],
                onTap: () async {
                  final result = await Navigator.of(context).pushNamed(
                    '/expenses/edit',
                    arguments: _recentExpenses[index],
                  );
                  if (result == true) _loadData();
                },
              ),
            ),
          ),
        const SizedBox(height: 80), // Space for FAB
      ],
    );
  }
}
