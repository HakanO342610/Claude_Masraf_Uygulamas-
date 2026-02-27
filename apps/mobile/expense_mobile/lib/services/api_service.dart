import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/expense.dart';
import '../config/app_config.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  static String baseUrl = AppConfig.apiBaseUrl;
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

  Future<dynamic> _handleResponse(http.Response response) async {
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
      // Try to refresh the token before giving up
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        throw ApiException('TOKEN_REFRESHED', statusCode: 401);
      }
      clearAuth();
      throw ApiException('Session expired. Please log in again.', statusCode: 401);
    }

    throw ApiException(message, statusCode: response.statusCode);
  }

  Future<dynamic> _get(String path, {bool retried = false}) async {
    await _loadToken();
    try {
      final response = await http
          .get(Uri.parse('$baseUrl$path'), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException catch (e) {
      if (e.message == 'TOKEN_REFRESHED' && !retried) {
        return _get(path, retried: true);
      }
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body,
      {bool withAuth = true, bool retried = false}) async {
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
    } on ApiException catch (e) {
      if (e.message == 'TOKEN_REFRESHED' && !retried) {
        return _post(path, body, withAuth: withAuth, retried: true);
      }
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> body,
      {bool retried = false}) async {
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
    } on ApiException catch (e) {
      if (e.message == 'TOKEN_REFRESHED' && !retried) {
        return _patch(path, body, retried: true);
      }
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  Future<dynamic> _delete(String path, {bool retried = false}) async {
    await _loadToken();
    try {
      final response = await http
          .delete(Uri.parse('$baseUrl$path'), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on ApiException catch (e) {
      if (e.message == 'TOKEN_REFRESHED' && !retried) {
        return _delete(path, retried: true);
      }
      rethrow;
    } catch (e) {
      throw ApiException('Network error: Unable to reach the server.');
    }
  }

  // ---------- Token Refresh ----------

  bool _isRefreshing = false;

  Future<bool> _tryRefreshToken() async {
    if (_isRefreshing) return false;
    _isRefreshing = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString(_refreshTokenKey);
      if (refreshToken == null) return false;

      final response = await http
          .post(
            Uri.parse('$baseUrl/auth/refresh'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body);
        await _saveToken(data['accessToken']);
        if (data['refreshToken'] != null) {
          await _saveRefreshToken(data['refreshToken']);
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      _isRefreshing = false;
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
    final data = await _patch('/expenses/$id/submit', {});
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> approveExpense(String id) async {
    final data = await _patch('/expenses/$id/approve', {});
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  Future<Expense> rejectExpense(String id, {String? reason}) async {
    final body = <String, dynamic>{};
    if (reason != null) body['comment'] = reason;
    final data = await _patch('/expenses/$id/reject', body);
    return Expense.fromJson(data is Map && data.containsKey('data') ? data['data'] : data);
  }

  // ---------- Dashboard / Summary ----------

  Future<Map<String, dynamic>> getDashboardSummary() async {
    try {
      final data = await _get('/reports/summary');
      return data is Map<String, dynamic> ? data : {};
    } catch (_) {
      return {};
    }
  }

  // ---------- Reports Endpoints ----------

  Future<Map<String, dynamic>> getReportSummary({String? from, String? to}) async {
    String path = '/reports/summary';
    final params = <String>[];
    if (from != null) params.add('from=$from');
    if (to != null) params.add('to=$to');
    if (params.isNotEmpty) path += '?${params.join('&')}';

    final data = await _get(path);
    return data is Map<String, dynamic> ? data : {};
  }

  Future<List<Map<String, dynamic>>> getReportByCategory({String? from, String? to}) async {
    String path = '/reports/by-category';
    final params = <String>[];
    if (from != null) params.add('from=$from');
    if (to != null) params.add('to=$to');
    if (params.isNotEmpty) path += '?${params.join('&')}';

    final data = await _get(path);
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<List<Map<String, dynamic>>> getReportByDepartment({String? from, String? to}) async {
    String path = '/reports/by-department';
    final params = <String>[];
    if (from != null) params.add('from=$from');
    if (to != null) params.add('to=$to');
    if (params.isNotEmpty) path += '?${params.join('&')}';

    final data = await _get(path);
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> getReportMonthly({int? year}) async {
    String path = '/reports/monthly';
    if (year != null) path += '?year=$year';

    final data = await _get(path);
    return data is Map<String, dynamic> ? data : {};
  }

  // ---------- Receipts Endpoints ----------

  Future<List<Map<String, dynamic>>> getMyReceipts() async {
    final data = await _get('/receipts/my');
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> uploadReceipt(String filePath, String mimeType) async {
    await _loadToken();
    final uri = Uri.parse('$baseUrl/receipts/upload');
    final request = http.MultipartRequest('POST', uri);
    request.headers['Authorization'] = 'Bearer $_token';
    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    final streamedResponse = await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException('Upload failed', statusCode: response.statusCode);
  }

  Future<void> attachReceiptToExpense(String receiptId, String expenseId) async {
    await _patch('/receipts/$receiptId/attach-to-expense/$expenseId', {});
  }
}
