'use client';

import { useEffect, useState } from 'react';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Filter,
} from 'lucide-react';
import { positionApi, departmentApi } from '@/lib/api';

interface Position {
  id: string;
  title: string;
  code: string;
  level: number;
  isActive: boolean;
  departmentId?: string;
  department?: { id: string; name: string; code: string } | null;
  parentPosition?: { id: string; title: string } | null;
  _count?: { users: number };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    departmentId: '',
    parentPositionId: '',
  });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');

  useEffect(() => {
    loadPositions();
    loadDepartments();
  }, [filterDeptId]);

  const loadPositions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterDeptId) params.departmentId = filterDeptId;
      const { data } = await positionApi.getAll(params);
      setPositions(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error('Pozisyonlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await departmentApi.getAll();
      setDepartments(Array.isArray(data) ? data : data.data || []);
    } catch {}
  };

  const openCreate = () => {
    setFormMode('create');
    setEditId(null);
    setFormData({ title: '', code: '', departmentId: filterDeptId || '', parentPositionId: '' });
    setShowForm(true);
  };

  const openEdit = (pos: Position) => {
    setFormMode('edit');
    setEditId(pos.id);
    setFormData({
      title: pos.title,
      code: pos.code,
      departmentId: pos.departmentId || '',
      parentPositionId: pos.parentPosition?.id || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        title: formData.title,
        code: formData.code,
      };
      if (formData.departmentId) payload.departmentId = formData.departmentId;
      if (formData.parentPositionId) payload.parentPositionId = formData.parentPositionId;

      if (formMode === 'create') {
        await positionApi.create(payload);
      } else {
        await positionApi.update(editId!, payload);
      }
      setShowForm(false);
      await loadPositions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu pozisyonu silmek istediğinize emin misiniz?')) return;
    try {
      await positionApi.delete(id);
      await loadPositions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Pozisyon silinemedi.');
    }
  };

  const filteredPositions = positions.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.department?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            💼 Pozisyon Yönetimi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Organizasyondaki pozisyon tanımları
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Yeni Pozisyon
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pozisyon ara..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Tüm Departmanlar</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Briefcase className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {searchQuery || filterDeptId ? 'Eşleşen pozisyon bulunamadı.' : 'Henüz pozisyon tanımlanmamış.'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pozisyon
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kod
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Departman
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Üst Pozisyon
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Seviye
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kişi
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPositions.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className={`w-4 h-4 ${pos.isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${pos.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                        {pos.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{pos.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {pos.department ? (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {pos.department.name}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {pos.parentPosition?.title || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{pos.level}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{pos._count?.users || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(pos)}
                        className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500"
                        title="Düzenle"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pos.id)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {formMode === 'create' ? '➕ Yeni Pozisyon' : '✏️ Pozisyon Düzenle'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unvan *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Yazılım Mühendisi"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kod *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="POS-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Departman</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seçiniz</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Üst Pozisyon</label>
                <select
                  value={formData.parentPositionId}
                  onChange={(e) => setFormData(prev => ({ ...prev, parentPositionId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Yok</option>
                  {positions
                    .filter((p) => p.id !== editId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title || !formData.code}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {formMode === 'create' ? 'Oluştur' : 'Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
