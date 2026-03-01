import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../services/auth_service.dart';
import '../providers/locale_provider.dart';

const List<String> _departments = [
  'IT', 'HR', 'Finance', 'Engineering', 'Sales', 'Marketing', 'Operations', 'Legal', 'Management'
];


class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  String? _selectedDepartment;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  String _translateDepartment(AppLocalizations? l10n, String dept) {
    if (l10n == null) return dept;
    switch (dept) {
      case 'IT': return 'Bilişim Teknolojileri';
      case 'Engineering': return 'Mühendislik';
      case 'Finance': return 'Finans';
      case 'Sales': return 'Satış';
      case 'Marketing': return 'Pazarlama';
      case 'Operations': return 'Operasyon';
      case 'Legal': return 'Hukuk';
      case 'Management': return 'Yönetim';
      case 'HR': return 'İnsan Kaynakları';
      default: return dept;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    final authService = context.read<AuthService>();
    final success = await authService.register(
      _nameController.text.trim(),
      _emailController.text.trim(),
      _passwordController.text,
      department: _selectedDepartment,
    );

    if (mounted && success) {
      final l10n = AppLocalizations.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n?.registerSuccess ?? 'Registration successful. Check email and wait for admin approval.'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final localeProvider = Provider.of<LocaleProvider>(context);
    final isTr = localeProvider.locale.languageCode == 'tr';

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.createAccount ?? 'Create Account'),
        actions: [
          TextButton.icon(
            onPressed: () {
              localeProvider.setLocale(Locale(isTr ? 'en' : 'tr'));
            },
            icon: const Icon(Icons.language, size: 20, color: Colors.white),
            label: Text(
              isTr ? 'EN' : 'TR',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
          )
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.person_add_outlined, size: 64, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    l10n?.getStarted ?? 'Get Started',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n?.getStartedSubtitle ?? 'Create your account to start tracking expenses',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 32),

                  // Error message
                  Consumer<AuthService>(
                    builder: (context, auth, _) {
                      if (auth.error == null) return const SizedBox.shrink();
                      return Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                auth.error!,
                                style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),

                  // Name field
                  TextFormField(
                    controller: _nameController,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      labelText: l10n?.fullName ?? 'Full Name',
                      hintText: l10n?.fullNameHint ?? 'Enter your full name',
                      prefixIcon: const Icon(Icons.person_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return l10n?.fullNameRequired ?? 'Please enter your name';
                      if (value.trim().length < 2) return l10n?.fullNameMinLength ?? 'Name must be at least 2 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: l10n?.email ?? 'Email',
                      hintText: l10n?.emailHint ?? 'Enter your email address',
                      prefixIcon: const Icon(Icons.email_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return l10n?.emailRequired ?? 'Please enter your email';
                      if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value.trim())) {
                        return l10n?.emailInvalid ?? 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: l10n?.password ?? 'Password',
                      hintText: l10n?.createPassword ?? 'Create a password',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) return l10n?.passwordRequired ?? 'Please enter a password';
                      if (value.length < 8) return l10n?.passwordMinLength8 ?? 'Password must be at least 8 characters';
                      if (!RegExp(r'[A-Z]').hasMatch(value)) return l10n?.passwordUppercase ?? 'Must contain uppercase letter';
                      if (!RegExp(r'[a-z]').hasMatch(value)) return l10n?.passwordLowercase ?? 'Must contain lowercase letter';
                      if (!RegExp(r'[0-9]').hasMatch(value)) return l10n?.passwordNumber ?? 'Must contain a number';
                      if (!RegExp(r'[^A-Za-z0-9]').hasMatch(value)) return l10n?.passwordSpecial ?? 'Must contain a special character';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Confirm password
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirm,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _handleRegister(),
                    decoration: InputDecoration(
                      labelText: l10n?.confirmPassword ?? 'Confirm Password',
                      hintText: l10n?.confirmPasswordHint ?? 'Re-enter your password',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureConfirm ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) return l10n?.confirmPasswordRequired ?? 'Please confirm your password';
                      if (value != _passwordController.text) return l10n?.passwordsDoNotMatch ?? 'Passwords do not match';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Department Dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedDepartment,
                    decoration: InputDecoration(
                      labelText: '${l10n?.department ?? 'Department'} (${l10n?.optional ?? 'optional'})',
                      prefixIcon: const Icon(Icons.business_outlined),
                    ),
                    items: _departments.map((dept) {
                      return DropdownMenuItem(
                        value: dept,
                        child: Text(isTr ? _translateDepartment(l10n, dept) : dept),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setState(() {
                        _selectedDepartment = val;
                      });
                    },
                  ),
                  const SizedBox(height: 24),

                  // Register button
                  Consumer<AuthService>(
                    builder: (context, auth, _) {
                      return FilledButton(
                        onPressed: auth.loading ? null : _handleRegister,
                        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                        child: auth.loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(l10n?.createAccount ?? 'Create Account', style: const TextStyle(fontSize: 16)),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${l10n?.alreadyHaveAccount ?? 'Already have an account?'} ',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(l10n?.signIn ?? 'Sign In'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
