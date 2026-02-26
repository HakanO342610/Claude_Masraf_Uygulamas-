class Expense {
  final String id;
  final DateTime expenseDate;
  final double amount;
  final String currency;
  final String category;
  final String costCenter;
  final String projectCode;
  final String description;
  final String status;
  final String? sapDocumentNumber;
  final String? createdAt;
  final String? updatedAt;

  Expense({
    required this.id,
    required this.expenseDate,
    required this.amount,
    required this.currency,
    required this.category,
    required this.costCenter,
    required this.projectCode,
    required this.description,
    required this.status,
    this.sapDocumentNumber,
    this.createdAt,
    this.updatedAt,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id']?.toString() ?? '',
      expenseDate: DateTime.tryParse(json['expenseDate'] ?? '') ?? DateTime.now(),
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      currency: json['currency'] ?? 'EUR',
      category: json['category'] ?? 'Other',
      costCenter: json['costCenter'] ?? '',
      projectCode: json['projectCode'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'draft',
      sapDocumentNumber: json['sapDocumentNumber'],
      createdAt: json['createdAt'],
      updatedAt: json['updatedAt'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'expenseDate': expenseDate.toIso8601String(),
      'amount': amount,
      'currency': currency,
      'category': category,
      'costCenter': costCenter,
      'projectCode': projectCode,
      'description': description,
    };
  }

  bool get isDraft => status == 'draft';
  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  String get statusLabel {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  }

  static const List<String> categories = [
    'Travel',
    'Accommodation',
    'Meals',
    'Transportation',
    'Office',
    'Other',
  ];

  static const List<String> currencies = [
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'JPY',
  ];
}
