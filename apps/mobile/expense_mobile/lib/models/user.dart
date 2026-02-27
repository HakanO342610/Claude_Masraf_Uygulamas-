class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final bool isApproved;
  final bool isEmailConfirmed;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.isApproved = true,
    this.isEmailConfirmed = true,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'user',
      isApproved: json['isApproved'] ?? true,
      isEmailConfirmed: json['isEmailConfirmed'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'isApproved': isApproved,
      'isEmailConfirmed': isEmailConfirmed,
    };
  }

  bool get isAdmin => role.toUpperCase() == 'ADMIN';
  bool get isManager => role.toUpperCase() == 'MANAGER';
  bool get isFinance => role.toUpperCase() == 'FINANCE';
  bool get canApprove => isAdmin || isManager || isFinance;
}
