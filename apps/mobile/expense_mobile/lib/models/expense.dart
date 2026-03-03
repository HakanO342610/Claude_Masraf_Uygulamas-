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
  final double? taxAmount;
  final String? receiptNumber;
  final String? createdAt;
  final String? updatedAt;

  /// SAP posting status — computed by backend from audit logs
  /// 'OK' | 'FAILED' | 'PENDING' | 'NOT_APPLICABLE'
  final String? sapStatus;
  final String? sapPostError;
  final String? sapPostSuccess;

  /// User info — populated when FINANCE/ADMIN views all expenses
  final Map<String, dynamic>? user;

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
    this.taxAmount,
    this.receiptNumber,
    this.createdAt,
    this.updatedAt,
    this.sapStatus,
    this.sapPostError,
    this.sapPostSuccess,
    this.user,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id']?.toString() ?? '',
      expenseDate:
          DateTime.tryParse(json['expenseDate'] ?? '') ?? DateTime.now(),
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      currency: json['currency'] ?? 'TRY',
      category: json['category'] ?? 'Other',
      costCenter: json['costCenter'] ?? '',
      projectCode: json['projectCode'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'DRAFT',
      sapDocumentNumber: json['sapDocumentNumber'],
      taxAmount: (json['taxAmount'] is num)
          ? (json['taxAmount'] as num).toDouble()
          : double.tryParse(json['taxAmount']?.toString() ?? '0'),
      receiptNumber: json['receiptNumber'],
      createdAt: json['createdAt'],
      updatedAt: json['updatedAt'],
      sapStatus: json['sapStatus'],
      sapPostError: json['sapPostError'],
      sapPostSuccess: json['sapPostSuccess'],
      user: json['user'] is Map<String, dynamic> ? json['user'] : null,
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
      if (taxAmount != null) 'taxAmount': taxAmount,
    };
  }

  bool get isDraft => status == 'DRAFT';
  bool get isSubmitted => status == 'SUBMITTED';
  bool get isManagerApproved => status == 'MANAGER_APPROVED';
  bool get isFinanceApproved => status == 'FINANCE_APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isPostedToSap => status == 'POSTED_TO_SAP';
  bool get isPending => isSubmitted || isManagerApproved;
  bool get isApproved => isFinanceApproved || isPostedToSap;

  // SAP convenience getters
  bool get isSapOk => sapStatus == 'OK';
  bool get isSapFailed => sapStatus == 'FAILED';
  bool get isSapPending => sapStatus == 'PENDING';
  String? get userName => user?['name'];
  String? get userEmail => user?['email'];

  String get statusLabel {
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

  static const List<String> categories = [
    'Travel',
    'Accommodation',
    'Food & Beverage',
    'Transportation',
    'Office Supplies',
    'Meals',
    'Office',
    'Other',
  ];

  static const List<String> currencies = [
    'TRY',
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'JPY',
  ];
}
