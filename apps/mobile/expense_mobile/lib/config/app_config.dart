import 'dart:io' show Platform;

class AppConfig {
  static const String _envApiUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  /// API base URL.
  /// - Android emulator: http://10.0.2.2:3001/api/v1  (maps to host localhost)
  /// - iOS simulator:    http://localhost:3001/api/v1
  /// - Physical device:  set via --dart-define=API_BASE_URL=https://your-server.com/api/v1
  static String get apiBaseUrl {
    if (_envApiUrl.isNotEmpty) return _envApiUrl;

    // Auto-detect: iOS simulator uses localhost, Android emulator uses 10.0.2.2
    if (Platform.isIOS) {
      return 'http://localhost:3001/api/v1';
    }
    return 'http://10.0.2.2:3001/api/v1';
  }
}
