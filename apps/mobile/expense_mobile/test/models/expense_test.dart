import 'package:flutter_test/flutter_test.dart';
import 'package:expense_mobile/models/expense.dart';

void main() {
  group('Expense model', () {
    final sampleJson = {
      'id': 'e1',
      'expenseDate': '2025-01-15T00:00:00.000Z',
      'amount': 500.0,
      'currency': 'TRY',
      'category': 'Travel',
      'costCenter': 'CC001',
      'projectCode': 'PRJ-01',
      'description': 'Business trip',
      'status': 'DRAFT',
      'taxAmount': 90.0,
    };

    test('fromJson parses all fields correctly', () {
      final expense = Expense.fromJson(sampleJson);
      expect(expense.id, 'e1');
      expect(expense.amount, 500.0);
      expect(expense.currency, 'TRY');
      expect(expense.category, 'Travel');
      expect(expense.costCenter, 'CC001');
      expect(expense.projectCode, 'PRJ-01');
      expect(expense.description, 'Business trip');
      expect(expense.status, 'DRAFT');
      expect(expense.taxAmount, 90.0);
    });

    test('fromJson handles missing optional fields with defaults', () {
      final minimalJson = {
        'id': 'e2',
        'expenseDate': '2025-02-01T00:00:00.000Z',
        'amount': 100,
        'status': 'SUBMITTED',
      };
      final expense = Expense.fromJson(minimalJson);
      expect(expense.currency, 'TRY');
      expect(expense.category, 'Other');
      expect(expense.costCenter, '');
      expect(expense.projectCode, '');
      expect(expense.description, '');
      expect(expense.taxAmount, isNull);
    });

    test('fromJson parses integer amount', () {
      final json = {...sampleJson, 'amount': 1200};
      final expense = Expense.fromJson(json);
      expect(expense.amount, 1200.0);
      expect(expense.amount, isA<double>());
    });

    test('fromJson parses string amount', () {
      final json = {...sampleJson, 'amount': '750.50'};
      final expense = Expense.fromJson(json);
      expect(expense.amount, 750.50);
    });

    group('status computed properties', () {
      Expense withStatus(String status) =>
          Expense.fromJson({...sampleJson, 'status': status});

      test('isDraft is true for DRAFT status', () {
        expect(withStatus('DRAFT').isDraft, isTrue);
        expect(withStatus('SUBMITTED').isDraft, isFalse);
      });

      test('isSubmitted is true for SUBMITTED status', () {
        expect(withStatus('SUBMITTED').isSubmitted, isTrue);
        expect(withStatus('DRAFT').isSubmitted, isFalse);
      });

      test('isRejected is true for REJECTED status', () {
        expect(withStatus('REJECTED').isRejected, isTrue);
      });

      test('isPending covers SUBMITTED and MANAGER_APPROVED', () {
        expect(withStatus('SUBMITTED').isPending, isTrue);
        expect(withStatus('MANAGER_APPROVED').isPending, isTrue);
        expect(withStatus('FINANCE_APPROVED').isPending, isFalse);
        expect(withStatus('DRAFT').isPending, isFalse);
      });

      test('isApproved covers FINANCE_APPROVED and POSTED_TO_SAP', () {
        expect(withStatus('FINANCE_APPROVED').isApproved, isTrue);
        expect(withStatus('POSTED_TO_SAP').isApproved, isTrue);
        expect(withStatus('MANAGER_APPROVED').isApproved, isFalse);
      });
    });

    group('statusLabel', () {
      Expense withStatus(String status) =>
          Expense.fromJson({...sampleJson, 'status': status});

      test('returns correct label for DRAFT', () {
        expect(withStatus('DRAFT').statusLabel, 'Draft');
      });

      test('returns correct label for SUBMITTED', () {
        expect(withStatus('SUBMITTED').statusLabel, 'Submitted');
      });

      test('returns correct label for MANAGER_APPROVED', () {
        expect(withStatus('MANAGER_APPROVED').statusLabel, 'Manager Approved');
      });

      test('returns correct label for FINANCE_APPROVED', () {
        expect(withStatus('FINANCE_APPROVED').statusLabel, 'Finance Approved');
      });

      test('returns correct label for REJECTED', () {
        expect(withStatus('REJECTED').statusLabel, 'Rejected');
      });

      test('returns correct label for POSTED_TO_SAP', () {
        expect(withStatus('POSTED_TO_SAP').statusLabel, 'Posted to SAP');
      });
    });

    test('toJson contains expected keys', () {
      final expense = Expense.fromJson(sampleJson);
      final json = expense.toJson();
      expect(json.containsKey('amount'), isTrue);
      expect(json.containsKey('currency'), isTrue);
      expect(json.containsKey('category'), isTrue);
      expect(json.containsKey('description'), isTrue);
      expect(json.containsKey('expenseDate'), isTrue);
      expect(json['taxAmount'], 90.0);
    });

    test('toJson omits null taxAmount', () {
      final expense = Expense.fromJson({...sampleJson, 'taxAmount': null});
      final json = expense.toJson();
      expect(json.containsKey('taxAmount'), isFalse);
    });

    test('categories list is not empty', () {
      expect(Expense.categories, isNotEmpty);
      expect(Expense.categories, contains('Travel'));
      expect(Expense.categories, contains('Accommodation'));
    });

    test('currencies list contains TRY', () {
      expect(Expense.currencies, contains('TRY'));
      expect(Expense.currencies, contains('EUR'));
      expect(Expense.currencies, contains('USD'));
    });
  });
}
