import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/api_service.dart';

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
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final users = await _api.getUsers();
      setState(() {
        _users = users;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // ─── Approve ─────────────────────────────────────────────
  Future<void> _approveUser(String id) async {
    try {
      await _api.approveUser(id);
      _showSnack('User approved');
      _loadUsers();
    } catch (e) {
      _showSnack('Failed: $e', isError: true);
    }
  }

  // ─── Role Change ─────────────────────────────────────────
  Future<void> _updateRole(String id, String newRole) async {
    try {
      await _api.updateUserRole(id, newRole);
      _showSnack('Role updated');
      _loadUsers();
    } catch (e) {
      _showSnack('Failed: $e', isError: true);
    }
  }

  void _showRoleDialog(User user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Role: ${user.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: ['ADMIN', 'MANAGER', 'FINANCE', 'EMPLOYEE']
              .map((role) => ListTile(
                    title: Text(role),
                    trailing: user.role == role
                        ? const Icon(Icons.check, color: Colors.green)
                        : null,
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

  // ─── Manager Assignment ──────────────────────────────────
  void _showManagerDialog(User user) {
    final managers = _users.where((u) => u.id != user.id).toList();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Manager: ${user.name}'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView(
            shrinkWrap: true,
            children: managers
                .map((m) => ListTile(
                      title: Text(m.name),
                      subtitle: Text(m.role),
                      onTap: () async {
                        Navigator.of(ctx).pop();
                        try {
                          await _api.assignManager(user.id, m.id);
                          _showSnack('Manager assigned: ${m.name}');
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

  // ─── Edit User Info ──────────────────────────────────────
  void _showEditDialog(User user) {
    final nameCtrl = TextEditingController(text: user.name);
    final emailCtrl = TextEditingController(text: user.email);
    final deptCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit User'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: deptCtrl,
              decoration: const InputDecoration(labelText: 'Department'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
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
                _showSnack('User updated');
                _loadUsers();
              } catch (e) {
                _showSnack('Failed: $e', isError: true);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  // ─── Delete User ─────────────────────────────────────────
  void _confirmDelete(User user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete User'),
        content: Text('Are you sure you want to delete "${user.name}"?\nThis action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await _api.deleteUser(user.id);
                _showSnack('User deleted');
                _loadUsers();
              } catch (e) {
                _showSnack('Failed: $e', isError: true);
              }
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  // ─── Card UI ─────────────────────────────────────────────
  Widget _buildUserCard(User user) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name + Role badge
            Row(
              children: [
                Expanded(
                  child: Text(
                    user.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    user.role,
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

            // Status chips
            Wrap(
              spacing: 8,
              children: [
                _statusChip(
                  user.isApproved ? Icons.check_circle : Icons.pending,
                  user.isApproved ? 'Approved' : 'Pending',
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

            // Action buttons
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (!user.isApproved)
                  _actionBtn(Icons.check, 'Approve', Colors.green, () => _approveUser(user.id)),
                _actionBtn(Icons.badge, 'Role', Colors.indigo, () => _showRoleDialog(user)),
                _actionBtn(Icons.supervisor_account, 'Manager', Colors.teal, () => _showManagerDialog(user)),
                _actionBtn(Icons.edit, 'Edit', Colors.blue, () => _showEditDialog(user)),
                _actionBtn(Icons.delete_outline, 'Delete', Colors.red, () => _confirmDelete(user)),
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

  // ─── Build ──────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('User Management'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadUsers),
        ],
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
                      ElevatedButton(onPressed: _loadUsers, child: const Text('Retry')),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  physics: const BouncingScrollPhysics(
                    parent: AlwaysScrollableScrollPhysics(),
                  ),
                  padding: const EdgeInsets.only(bottom: 40),
                  child: Column(
                    children: _users.isEmpty
                        ? [const SizedBox(height: 200), const Center(child: Text('No users found'))]
                        : _users.map((user) => _buildUserCard(user)).toList(),
                  ),
                ),
    );
  }
}
