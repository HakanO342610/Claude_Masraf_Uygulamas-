import 'package:flutter/foundation.dart';
import '../models/user.dart';
import 'api_service.dart';

enum AuthStatus {
  uninitialized,
  authenticated,
  unauthenticated,
}

class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService();

  AuthStatus _status = AuthStatus.uninitialized;
  User? _user;
  String? _error;
  bool _loading = false;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get error => _error;
  bool get loading => _loading;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  AuthService() {
    _initialize();
  }

  Future<void> _initialize() async {
    _loading = true;
    notifyListeners();

    try {
      final hasToken = await _api.hasToken();
      if (hasToken) {
        // Uygulama her açılışında refresh token ile access token'ı yenile.
        // Refresh token geçerliyse (30 gün) → kullanıcı hiç "session expired" görmez.
        // Refresh token da süresi dolmuşsa → login ekranına yönlendir (hata banner'ı olmadan).
        final online = await _api.isOnline();
        if (online) {
          // İnternet varsa token'ı yenile.
          final refreshed = await _api.refreshSession();
          if (refreshed) {
            _user = await _api.getSavedUser();
            _status = _user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
          } else {
            // Online + refresh başarısız → gerçekten süresi dolmuş → sessizce logout.
            await _api.clearAuth();
            _status = AuthStatus.unauthenticated;
          }
        } else {
          // Offline → mevcut kullanıcı verisiyle devam et, cache'den çalış.
          _user = await _api.getSavedUser();
          _status = _user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
        }
      } else {
        _status = AuthStatus.unauthenticated;
      }
    } catch (_) {
      _status = AuthStatus.unauthenticated;
    }

    _loading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _api.login(email, password);
      _status = AuthStatus.authenticated;
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _status = AuthStatus.unauthenticated;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'An unexpected error occurred. Please try again.';
      _status = AuthStatus.unauthenticated;
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password, {String? department}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.register(name, email, password, department: department);
      
      // Store the message or let the UI handle success
      // We do NOT set _status = AuthStatus.authenticated
      // We do NOT set _user
      
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'An unexpected error occurred. Please try again.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _loading = true;
    notifyListeners();

    await _api.logout();
    _user = null;
    _status = AuthStatus.unauthenticated;
    _error = null;
    _loading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
