import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:expense_mobile/models/expense.dart';
import 'package:expense_mobile/widgets/expense_card.dart';

Expense _makeExpense({
  String id = 'e1',
  double amount = 500.0,
  String currency = 'TRY',
  String category = 'Travel',
  String description = 'Business trip',
  String status = 'DRAFT',
  double? taxAmount,
  String costCenter = '',
  String projectCode = '',
}) {
  return Expense(
    id: id,
    expenseDate: DateTime(2025, 1, 15),
    amount: amount,
    currency: currency,
    category: category,
    costCenter: costCenter,
    projectCode: projectCode,
    description: description,
    status: status,
    taxAmount: taxAmount,
  );
}

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('ExpenseCard widget', () {
    testWidgets('displays description and amount', (tester) async {
      final expense = _makeExpense(
        description: 'Ankara İş Seyahati',
        amount: 750.50,
        currency: 'TRY',
      );

      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));

      expect(find.text('Ankara İş Seyahati'), findsOneWidget);
      expect(find.textContaining('750.50'), findsOneWidget);
      expect(find.textContaining('TRY'), findsOneWidget);
    });

    testWidgets('shows DRAFT status badge', (tester) async {
      final expense = _makeExpense(status: 'DRAFT');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Draft'), findsOneWidget);
    });

    testWidgets('shows SUBMITTED status badge', (tester) async {
      final expense = _makeExpense(status: 'SUBMITTED');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Submitted'), findsOneWidget);
    });

    testWidgets('shows MANAGER_APPROVED status badge', (tester) async {
      final expense = _makeExpense(status: 'MANAGER_APPROVED');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Manager Approved'), findsOneWidget);
    });

    testWidgets('shows FINANCE_APPROVED status badge', (tester) async {
      final expense = _makeExpense(status: 'FINANCE_APPROVED');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Finance Approved'), findsOneWidget);
    });

    testWidgets('shows REJECTED status badge', (tester) async {
      final expense = _makeExpense(status: 'REJECTED');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Rejected'), findsOneWidget);
    });

    testWidgets('shows POSTED_TO_SAP status badge', (tester) async {
      final expense = _makeExpense(status: 'POSTED_TO_SAP');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Posted to SAP'), findsOneWidget);
    });

    testWidgets('shows KDV line when taxAmount is set', (tester) async {
      final expense = _makeExpense(amount: 1000.0, taxAmount: 180.0);
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.textContaining('KDV'), findsOneWidget);
      expect(find.textContaining('180.00'), findsOneWidget);
    });

    testWidgets('does not show KDV when taxAmount is null', (tester) async {
      final expense = _makeExpense(taxAmount: null);
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.textContaining('KDV'), findsNothing);
    });

    testWidgets('does not show KDV when taxAmount is zero', (tester) async {
      final expense = _makeExpense(taxAmount: 0.0);
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.textContaining('KDV'), findsNothing);
    });

    testWidgets('shows category tag', (tester) async {
      final expense = _makeExpense(category: 'Travel');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('Travel'), findsOneWidget);
    });

    testWidgets('shows costCenter tag when not empty', (tester) async {
      final expense = _makeExpense(costCenter: 'CC-ISTANBUL');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('CC-ISTANBUL'), findsOneWidget);
    });

    testWidgets('shows projectCode tag when not empty', (tester) async {
      final expense = _makeExpense(projectCode: 'PRJ-2025');
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      expect(find.text('PRJ-2025'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      bool tapped = false;
      final expense = _makeExpense();

      await tester.pumpWidget(
        _wrap(ExpenseCard(expense: expense, onTap: () => tapped = true)),
      );

      await tester.tap(find.byType(InkWell));
      expect(tapped, isTrue);
    });

    testWidgets('shows formatted date', (tester) async {
      final expense = _makeExpense();
      await tester.pumpWidget(_wrap(ExpenseCard(expense: expense)));
      // Date formatted as 'MMM d, yyyy' → 'Jan 15, 2025'
      expect(find.textContaining('Jan 15, 2025'), findsOneWidget);
    });
  });
}
