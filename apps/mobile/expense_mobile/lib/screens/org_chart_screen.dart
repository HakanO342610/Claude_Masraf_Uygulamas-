import 'package:flutter/material.dart';
import '../services/api_service.dart';

class OrgChartScreen extends StatefulWidget {
  const OrgChartScreen({super.key});

  @override
  State<OrgChartScreen> createState() => _OrgChartScreenState();
}

class _OrgChartScreenState extends State<OrgChartScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _tree = [];
  bool _loading = true;
  String? _error;
  final Set<String> _expanded = {};

  @override
  void initState() {
    super.initState();
    _loadTree();
  }

  Future<void> _loadTree() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await _api.getDepartmentTree();
      setState(() { _tree = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Organizasyon Şeması'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadTree),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _loadTree, child: const Text('Yenile')),
                  ],
                ))
              : _tree.isEmpty
                  ? const Center(child: Text('Departman bulunamadı.'))
                  : RefreshIndicator(
                      onRefresh: _loadTree,
                      child: ListView(
                        padding: const EdgeInsets.all(12),
                        children: _tree.map((d) => _DeptNode(
                          dept: d,
                          depth: 0,
                          expanded: _expanded,
                          onToggle: (id) => setState(() {
                            if (_expanded.contains(id)) {
                              _expanded.remove(id);
                            } else {
                              _expanded.add(id);
                            }
                          }),
                        )).toList(),
                      ),
                    ),
    );
  }
}

class _DeptNode extends StatelessWidget {
  final Map<String, dynamic> dept;
  final int depth;
  final Set<String> expanded;
  final ValueChanged<String> onToggle;

  const _DeptNode({
    required this.dept,
    required this.depth,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final id = dept['id'] as String? ?? '';
    final name = dept['name'] as String? ?? '';
    final code = dept['code'] as String? ?? '';
    final children = (dept['children'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final manager = dept['manager'] as Map<String, dynamic>?;
    final counts = dept['_count'] as Map<String, dynamic>?;
    final userCount = counts?['users'] ?? 0;
    final posCount = counts?['positions'] ?? 0;
    final hasChildren = children.isNotEmpty;
    final isExpanded = expanded.contains(id);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: EdgeInsets.only(left: depth * 20.0, bottom: 4),
          decoration: BoxDecoration(
            color: depth == 0
                ? const Color(0xFF1E3A8A).withOpacity(0.08)
                : depth == 1
                    ? const Color(0xFF1E3A8A).withOpacity(0.04)
                    : Colors.grey.withOpacity(0.04),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: const Color(0xFF1E3A8A).withOpacity(0.15),
            ),
          ),
          child: ListTile(
            dense: true,
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: _levelColor(depth),
              child: Text(
                code.isNotEmpty ? code[0] : '?',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
              ),
            ),
            title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(code, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                if (manager != null)
                  Row(children: [
                    const Icon(Icons.person_outline, size: 12),
                    const SizedBox(width: 4),
                    Text(manager['name'] as String? ?? '', style: const TextStyle(fontSize: 11)),
                  ]),
                Row(children: [
                  const Icon(Icons.people_outline, size: 12),
                  const SizedBox(width: 2),
                  Text('$userCount kişi', style: const TextStyle(fontSize: 11)),
                  const SizedBox(width: 8),
                  const Icon(Icons.work_outline, size: 12),
                  const SizedBox(width: 2),
                  Text('$posCount pozisyon', style: const TextStyle(fontSize: 11)),
                ]),
              ],
            ),
            trailing: hasChildren
                ? IconButton(
                    icon: Icon(isExpanded ? Icons.expand_less : Icons.expand_more),
                    onPressed: () => onToggle(id),
                  )
                : null,
          ),
        ),
        if (hasChildren && isExpanded)
          ...children.map((child) => _DeptNode(
            dept: child,
            depth: depth + 1,
            expanded: expanded,
            onToggle: onToggle,
          )),
      ],
    );
  }

  Color _levelColor(int depth) {
    const colors = [Color(0xFF1E3A8A), Color(0xFF2563EB), Color(0xFF60A5FA), Color(0xFF93C5FD)];
    return colors[depth.clamp(0, colors.length - 1)];
  }
}
