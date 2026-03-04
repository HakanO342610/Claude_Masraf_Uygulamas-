import 'package:flutter/material.dart';
import '../services/api_service.dart';

class PositionsScreen extends StatefulWidget {
  const PositionsScreen({super.key});

  @override
  State<PositionsScreen> createState() => _PositionsScreenState();
}

class _PositionsScreenState extends State<PositionsScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _positions = [];
  List<Map<String, dynamic>> _departments = [];
  bool _loading = true;
  String? _error;
  String? _selectedDeptId;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _api.getPositions(departmentId: _selectedDeptId),
        _api.getDepartments(),
      ]);
      setState(() {
        _positions = results[0] as List<Map<String, dynamic>>;
        _departments = results[1] as List<Map<String, dynamic>>;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _positions;
    final q = _search.toLowerCase();
    return _positions.where((p) {
      final title = (p['title'] as String? ?? '').toLowerCase();
      final code = (p['code'] as String? ?? '').toLowerCase();
      return title.contains(q) || code.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pozisyonlar'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          // Search + Filter
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Pozisyon ara...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _search = v),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<String?>(
                  value: _selectedDeptId,
                  hint: const Text('Departman', style: TextStyle(fontSize: 12)),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Tümü')),
                    ..._departments.map((d) => DropdownMenuItem(
                      value: d['id'] as String,
                      child: Text(d['code'] as String? ?? '', style: const TextStyle(fontSize: 12)),
                    )),
                  ],
                  onChanged: (v) {
                    setState(() => _selectedDeptId = v);
                    _load();
                  },
                ),
              ],
            ),
          ),

          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: Colors.red),
                          const SizedBox(height: 12),
                          Text(_error!, style: const TextStyle(color: Colors.red)),
                          ElevatedButton(onPressed: _load, child: const Text('Yenile')),
                        ],
                      ))
                    : _filtered.isEmpty
                        ? const Center(child: Text('Pozisyon bulunamadı.'))
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                              itemCount: _filtered.length,
                              itemBuilder: (ctx, i) => _PositionCard(pos: _filtered[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _PositionCard extends StatelessWidget {
  final Map<String, dynamic> pos;
  const _PositionCard({required this.pos});

  @override
  Widget build(BuildContext context) {
    final title = pos['title'] as String? ?? '';
    final code = pos['code'] as String? ?? '';
    final level = pos['level'] as int? ?? 0;
    final dept = pos['department'] as Map<String, dynamic>?;
    final parent = pos['parentPosition'] as Map<String, dynamic>?;
    final counts = pos['_count'] as Map<String, dynamic>?;
    final userCount = counts?['users'] ?? 0;
    final childCount = counts?['childPositions'] ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFF1E3A8A).withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              'L$level',
              style: const TextStyle(
                color: Color(0xFF1E3A8A),
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(code, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
            if (dept != null)
              Row(children: [
                const Icon(Icons.business, size: 12),
                const SizedBox(width: 4),
                Text(dept['name'] as String? ?? '', style: const TextStyle(fontSize: 11)),
              ]),
            if (parent != null)
              Row(children: [
                const Icon(Icons.account_tree_outlined, size: 12),
                const SizedBox(width: 4),
                Text('↑ ${parent['title']}', style: const TextStyle(fontSize: 11)),
              ]),
            Row(children: [
              const Icon(Icons.people_outline, size: 12),
              const SizedBox(width: 2),
              Text('$userCount kişi', style: const TextStyle(fontSize: 11)),
              if (childCount > 0) ...[
                const SizedBox(width: 8),
                const Icon(Icons.account_tree, size: 12),
                const SizedBox(width: 2),
                Text('$childCount alt pozisyon', style: const TextStyle(fontSize: 11)),
              ],
            ]),
          ],
        ),
        isThreeLine: true,
      ),
    );
  }
}
