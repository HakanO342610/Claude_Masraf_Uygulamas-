import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocaleProvider extends ChangeNotifier {
  static const _key = 'locale';
  Locale _locale = const Locale('tr', 'TR');

  Locale get locale => _locale;
  bool get isTurkish => _locale.languageCode == 'tr';

  LocaleProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_key);
    if (stored == 'en') {
      _locale = const Locale('en', 'US');
    } else {
      _locale = const Locale('tr', 'TR');
    }
    notifyListeners();
  }

  Future<void> toggle() async {
    _locale = isTurkish ? const Locale('en', 'US') : const Locale('tr', 'TR');
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, _locale.languageCode);
  }
}
