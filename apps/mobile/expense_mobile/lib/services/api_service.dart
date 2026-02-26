import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/expense.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  static const String baseUrl = 'http://localhost:3001/api/v1';
  static const String _tokenKey = 'jwt_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';

  String? _token;

  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  // ---------- Token Management ----------

  Future<void> _loadToken() async {
    if (_token != null) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  Future<void> _saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> _saveRefreshToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_refreshTokenKey, token);
  }

  Future<void> _saveUser(User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  Future<User?> getSavedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_userKey);
    if (userData == null) return null;
    try {
      return User.fromJson(jsonDecode(userData));
    } catch (_) {
      return null;
    }
  }

  Future<bool> hasToken() async {
    await _loadToken();
    return _token != null && _token!.isNotEmpty;
  }

  Future<void> clearAuth() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_userKey);
  }

  // ---------- HTTP Helpers ----------

  Map<String, String> _headers({bool withAuth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (withAuth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  dynamic _handleResponse(http.Response response) {
    final body = response.body.isNotEmpty ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    String message = 'An error occurred';
    if (body is Map && body.containsKey('message')) {
      message = body['message'] is List
          ? (body['message'] as List).join(', ')
          : body['message'].toString();
    }

    if (response.statusCode == 401) {
      clearAuth();
      throw ApiException('Session expired. Please log in again.', statusCode: 401);
    }

    throw ApiException(message, statusCode: response.statusCode);
  }

  Future<dynamic> _get(String path) async {
    await _loadToken();
    try {
      final response = await http
          .get(Uri.parse('$baseUrl$path'), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body,
      {bool withAuth = true}) async {
    await _loadToken();
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl$path'),
            headers: _headers(withAuth: withAuth),
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> body) async {
    await _loadToken();
    try {
      final response = await http
          .patch(
            Uri.parse('$baseUrl$path'),
            headers: _headers(),
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _delete(String path) async {
    await _loadToken();
    try {
      final response = await http
          .delete(Uri.parse('$baseUrl$path'), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  // ---------- Auth Endpoints ----------

  Future<User> login(String email, String password) async {
    final data = await _post('/auth/login', {
      'email': email,
      'password': password,
    }, withAuth: false);

    final token = data['accessToken'] ?? data['access_token'] ?? data['token'];
    if (token == null) {
      throw ApiException('Invalid response from server.');
    }

    await _saveToken(token);

    if (data['refreshToken'] != null) {
      await _saveRefreshToken(data['refreshToken']);
    }

    final user = User.fromJson(data['user'] ?? data);
    await _saveUser(user);
    return user;
  }

  Future<User> register(String name, String email, String password) async {
    final data = await _post('/auth/register', {
      'name': name,
      'email': email,
      'password': password,
    }, withAuth: false);

    final token = data['accessToken'] ?? data['access_token'] ?? data['token'];
    if (token != null) {
      await _saveToken(token);
    }

    if (data['refreshToken'] != null) {
      await _saveRefreshToken(data['refreshToken']);
    }

    final user = User.fromJson(data['user'] ?? data);
    await _saveUser(user);
    return user;
  }

  Future<void> logout() async {
    try {
      await _post('/auth/logout', {});
    } catch (_) {
      // Ignore errors during logout
    }
    await clearAuth();
  }

  // ---------- Expense Endpoints ----------

  Future<List<Expense>> getExpenses({String? status, int page = 1, int limit = 20}) async {
    String path = '/expenses?page=$page&limit=$limit';
    if (status != null && status.isNotEmpty) {
      path += '&status=$status';
    }

    final data = await _get(path);

    List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map && data.containsKey('data')) {
      items = data['data'] as List;
    } else if (data is Map && data.containsKey('items')) {
      items = data['items'] as List;
    } else {
      items = [];
    }

    return items.map((json) => Expense.fromJson(json)).toList();
  }

  Future<Expense> getExpense(String id) async {
    final data = await _get('/expenses/$id');
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> createExpense(Map<String, dynamic> expenseData) async {
    final data = await _post('/expenses', expenseData);
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> updateExpense(String id, Map<String, dynamic> expenseData) async {
    final data = await _patch('/expenses/$id', expenseData);
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<void> deleteExpense(String id) async {
    await _delete('/expenses/$id');
  }

  Future<Expense> submitExpense(String id) async {
    final data = await _post('/expenses/$id/submit', {});
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> approveExpense(String id) async {
    final data = await _post('/expenses/$id/approve', {});
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> rejectExpense(String id, {String? reason}) async {
    final body = <String, dynamic>{};
    if (reason != null) body['reason'] = reason;
    final data = await _post('/expenses/$id/reject', body);
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  // ---------- Dashboard / Summary ----------

  Future<Map<String, dynamic>> getDashboardSummary() async {
    try {
      final data = await _get('/expenses/summary');
      return data is Map<String, dynamic> ? data : {};
    } catch (_) {
      // If summary endpoint doesn't exist, calculate from expenses
      return {};
    }
  }
}
