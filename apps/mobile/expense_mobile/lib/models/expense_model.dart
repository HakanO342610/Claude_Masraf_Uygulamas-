import 'package:hive/hive.dart';
import 'expense.dart';

part 'expense_model.g.dart';

@HiveType(typeId: 0)
class ExpenseModel extends HiveObject {
  ExpenseModel();

  @HiveField(0)
  late String id;

  @HiveField(1)
  late String expenseDate;

  @HiveField(2)
  late double amount;

  @HiveField(3)
  late String currency;

  @HiveField(4)
  late String category;

  @HiveField(5)
  late String status;

  @HiveField(6)
  late String costCenter;

  @HiveField(7)
  late String projectCode;

  @HiveField(8)
  late String description;

  @HiveField(9)
  String? sapDocumentNumber;

  factory ExpenseModel.fromExpense(Expense expense) => ExpenseModel()
    ..id = expense.id
    ..expenseDate = expense.expenseDate.toIso8601String()
    ..amount = expense.amount
    ..currency = expense.currency
    ..category = expense.category
    ..status = expense.status
    ..costCenter = expense.costCenter
    ..projectCode = expense.projectCode
    ..description = expense.description
    ..sapDocumentNumber = expense.sapDocumentNumber;

  Expense toExpense() => Expense(
        id: id,
        expenseDate: DateTime.parse(expenseDate),
        amount: amount,
        currency: currency,
        category: category,
        costCenter: costCenter,
        projectCode: projectCode,
        description: description,
        status: status,
        sapDocumentNumber: sapDocumentNumber,
      );
}
