import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../models/user.dart';
import '../services/api_service.dart';

  String _translateRole(BuildContext context, String role) {
    bool isTr = Localizations.localeOf(context).languageCode.contains('tr');
    if (!isTr) return role;
    switch (role) {
      case 'MANAGER': return 'Yönetici';
      case 'FINANCE': return 'Finans';
      case 'EMPLOYEE': return 'Çalışan';
      case 'ADMIN': return 'Admin';
      default: return role;
    }
  }

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final ApiService _api = ApiService();
  List<User> _users = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() { _loading = true; _error = null; });
    try {
      final users = await _api.getUsers();
      setState(() { _users = users; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _approveUser(String id) async {
    try {
      await _api.approveUser(id);
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        _showSnack(l10n?.userApproved ?? 'User approved');
      }
      _loadUsers();
    } catch (e) {
      _showSnack('Failed: $e', isError: true);
    }
  }

  Future<void> _updateRole(String id, String newRole) async {
    try {
      await _api.updateUserRole(id, newRole);
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        _showSnack(l10n?.roleUpdated ?? 'Role updated');
      }
      _loadUsers();
    } catch (e) {
      _showSnack('Failed: $e', isError: true);
    }
  }

  void _showRoleDialog(User user) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${l10n?.role ?? 'Role'}: ${user.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: ['ADMIN', 'MANAGER', 'FINANCE', 'EMPLOYEE']
              .map((role) => ListTile(
                    title: Text(_translateRole(ctx, role)),
                    trailing: user.role == role ? const Icon(Icons.check, color: Colors.green) : null,
                    onTap: () {
                      Navigator.of(ctx).pop();
                      if (user.role != role) _updateRole(user.id, role);
                    },
                  ))
              .toList(),
        ),
      ),
    );
  }

  void _showManagerDialog(User user) {
    final l10n = AppLocalizations.of(context);
    final managers = _users.where((u) => u.id != user.id).toList();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${l10n?.manager ?? 'Manager'}: ${user.name}'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView(
            shrinkWrap: true,
            children: managers
                .map((m) => ListTile(
                      title: Text(m.name),
                      subtitle: Text(_translateRole(ctx, m.role)),
                      onTap: () async {
                        Navigator.of(ctx).pop();
                        try {
                          await _api.assignManager(user.id, m.id);
                          if (mounted) _showSnack('Manager assigned: ${m.name}');
                          _loadUsers();
                        } catch (e) {
                          _showSnack('Failed: $e', isError: true);
                        }
                      },
                    ))
                .toList(),
          ),
        ),
      ),
    );
  }

  void _showEditDialog(User user) {
    final l10n = AppLocalizations.of(context);
    final nameCtrl = TextEditingController(text: user.name);
    final emailCtrl = TextEditingController(text: user.email);
    final deptCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n?.editUser ?? 'Edit User'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: l10n?.name ?? 'Name')),
            const SizedBox(height: 12),
            TextField(controller: emailCtrl, decoration: InputDecoration(labelText: l10n?.email ?? 'Email')),
            const SizedBox(height: 12),
            TextField(controller: deptCtrl, decoration: InputDecoration(labelText: l10n?.department ?? 'Department')),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n?.cancel ?? 'Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await _api.updateUser(
                  user.id,
                  name: nameCtrl.text.isNotEmpty ? nameCtrl.text : null,
                  email: emailCtrl.text.isNotEmpty ? emailCtrl.text : null,
                  department: deptCtrl.text.isNotEmpty ? deptCtrl.text : null,
                );
                if (mounted) {
                  final l10n2 = AppLocalizations.of(context);
                  _showSnack(l10n2?.userUpdated ?? 'User updated');
                }
                _loadUsers();
              } catch (e) {
                _showSnack('Failed: $e', isError: true);
              }
            },
            child: Text(l10n?.save ?? 'Save'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(User user) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n?.deleteUser ?? 'Delete User'),
        content: Text(l10n?.deleteUserConfirm ?? 'Are you sure you want to delete this user? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n?.cancel ?? 'Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await _api.deleteUser(user.id);
                if (mounted) {
                  final l10n2 = AppLocalizations.of(context);
                  _showSnack(l10n2?.userDeleted ?? 'User deleted');
                }
                _loadUsers();
              } catch (e) {
                _showSnack('Failed: $e', isError: true);
              }
            },
            child: Text(l10n?.delete ?? 'Delete'),
          ),
        ],
      ),
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: isError ? Colors.red : null),
    );
  }

  Widget _buildUserCard(User user) {
    final l10n = AppLocalizations.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    user.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _translateRole(context, user.role),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(user.email, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                _statusChip(
                  user.isApproved ? Icons.check_circle : Icons.pending,
                  user.isApproved ? (l10n?.approved ?? 'Approved') : (l10n?.pending ?? 'Pending'),
                  user.isApproved ? Colors.green : Colors.orange,
                ),
                _statusChip(
                  user.isEmailConfirmed ? Icons.mark_email_read : Icons.mark_email_unread,
                  user.isEmailConfirmed ? 'Email ✓' : 'Email ✗',
                  user.isEmailConfirmed ? Colors.green : Colors.orange,
                ),
              ],
            ),
            const Divider(height: 20),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (!user.isApproved)
                  _actionBtn(Icons.check, l10n?.approve ?? 'Approve', Colors.green, () => _approveUser(user.id)),
                _actionBtn(Icons.badge, l10n?.role ?? 'Role', Colors.indigo, () => _showRoleDialog(user)),
                _actionBtn(Icons.supervisor_account, l10n?.manager ?? 'Manager', Colors.teal, () => _showManagerDialog(user)),
                _actionBtn(Icons.edit, l10n?.edit ?? 'Edit', Colors.blue, () => _showEditDialog(user)),
                _actionBtn(Icons.delete_outline, l10n?.delete ?? 'Delete', Colors.red, () => _confirmDelete(user)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(IconData icon, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(fontSize: 12, color: color)),
      ],
    );
  }

  Widget _actionBtn(IconData icon, String label, Color color, VoidCallback onTap) {
    return SizedBox(
      height: 32,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color.withValues(alpha: 0.4)),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          textStyle: const TextStyle(fontSize: 12),
        ),
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.userManagement ?? 'User Management'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _loadUsers)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ),
                      ElevatedButton(onPressed: _loadUsers, child: Text(l10n?.retry ?? 'Retry')),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                  padding: const EdgeInsets.only(bottom: 40),
                  child: Column(
                    children: _users.isEmpty
                        ? [const SizedBox(height: 200), Center(child: Text(l10n?.noUsersFound ?? 'No users found'))]
                        : _users.map((user) => _buildUserCard(user)).toList(),
                  ),
                ),
    );
  }
}
