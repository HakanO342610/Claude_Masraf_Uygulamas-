import 'package:hive_flutter/hive_flutter.dart';
import '../models/expense.dart';
import '../models/expense_model.dart';

class LocalStorageService {
  static const String _expenseBoxName = 'expenses_cache';

  static final LocalStorageService _instance = LocalStorageService._internal();
  factory LocalStorageService() => _instance;
  LocalStorageService._internal();

  Box<ExpenseModel>? _expenseBox;

  Future<void> init() async {
    _expenseBox = await Hive.openBox<ExpenseModel>(_expenseBoxName);
  }

  Box<ExpenseModel> get _box {
    if (_expenseBox == null || !_expenseBox!.isOpen) {
      throw StateError('LocalStorageService not initialized. Call init() first.');
    }
    return _expenseBox!;
  }

  Future<void> cacheExpenses(List<Expense> expenses) async {
    await _box.clear();
    final Map<String, ExpenseModel> modelMap = {
      for (final e in expenses) e.id: ExpenseModel.fromExpense(e),
    };
    await _box.putAll(modelMap);
  }

  List<Expense> getCachedExpenses() {
    return _box.values.map((m) => m.toExpense()).toList();
  }

  Future<void> clearCache() async {
    await _box.clear();
  }
}
