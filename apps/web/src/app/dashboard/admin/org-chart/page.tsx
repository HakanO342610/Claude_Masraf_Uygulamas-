'use client';

import { useEffect, useState } from 'react';
import {
  FolderTree,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Users,
  Briefcase,
  Loader2,
  X,
  Save,
  Building2,
} from 'lucide-react';
import { departmentApi, positionApi, usersApi } from '@/lib/api';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  code: string;
  level: number;
  isActive: boolean;
  parentId?: string;
  manager?: { id: string; name: string; email: string } | null;
  _count?: { users: number; positions: number; children: number };
  children: Department[];
}

export default function OrgChartPage() {
  const [tree, setTree] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ name: '', code: '', parentId: '', managerId: '' });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTree();
    loadUsers();
  }, []);

  const loadTree = async () => {
    try {
      setLoading(true);
      const { data } = await departmentApi.getTree();
      setTree(data);
      // İlk yüklemede tüm root'ları aç
      const rootIds = new Set<string>(data.map((d: Department) => d.id));
      setExpandedIds(rootIds);
    } catch (err) {
      console.error('Org chart yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await usersApi.getAll();
      setAllUsers(Array.isArray(data) ? data : data.data || []);
    } catch {}
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (depts: Department[]) => {
      for (const d of depts) {
        allIds.add(d.id);
        if (d.children?.length) collect(d.children);
      }
    };
    collect(tree);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const handleSelectDept = async (id: string) => {
    try {
      const { data } = await departmentApi.getById(id);
      setSelectedDept(data);
    } catch {}
  };

  const openCreateForm = (parentId?: string) => {
    setFormMode('create');
    setFormData({ name: '', code: '', parentId: parentId || '', managerId: '' });
    setShowForm(true);
  };

  const openEditForm = (dept: any) => {
    setFormMode('edit');
    setFormData({
      name: dept.name,
      code: dept.code,
      parentId: dept.parentId || '',
      managerId: dept.manager?.id || '',
    });
    setSelectedDept(dept);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (formMode === 'create') {
        await departmentApi.create({
          name: formData.name,
          code: formData.code,
          parentId: formData.parentId || undefined,
          managerId: formData.managerId || undefined,
        });
      } else {
        await departmentApi.update(selectedDept.id, {
          name: formData.name,
          code: formData.code,
          parentId: formData.parentId || null,
          managerId: formData.managerId || null,
        });
      }
      setShowForm(false);
      await loadTree();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu departmanı silmek istediğinize emin misiniz?')) return;
    try {
      await departmentApi.delete(id);
      setSelectedDept(null);
      await loadTree();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Silinemedi — alt departmanlar veya kullanıcılar mevcut olabilir.');
    }
  };

  const DeptNode = ({ dept, depth = 0 }: { dept: Department; depth?: number }) => {
    const isExpanded = expandedIds.has(dept.id);
    const hasChildren = dept.children?.length > 0;
    const isSelected = selectedDept?.id === dept.id;

    return (
      <div>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => handleSelectDept(dept.id)}
        >
          {/* Expand/collapse */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(dept.id); }}
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}
          </button>

          {/* İkon */}
          <FolderTree className={`w-4 h-4 ${dept.isActive ? 'text-blue-500' : 'text-gray-400'}`} />

          {/* Ad */}
          <span className={`text-sm font-medium ${dept.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
            {dept.name}
          </span>

          {/* Kod */}
          <span className="text-xs text-gray-400">({dept.code})</span>

          {/* Sayaçlar */}
          {(dept._count?.users ?? 0) > 0 && (
            <span className="ml-auto flex items-center gap-0.5 text-xs text-gray-400">
              <Users className="w-3 h-3" /> {dept._count?.users}
            </span>
          )}

          {/* Düzenle/Sil/Alt ekle */}
          <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); openCreateForm(dept.id); }}
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
              title="Alt departman ekle"
            >
              <Plus className="w-3 h-3 text-blue-500" />
            </button>
          </div>
        </div>

        {/* Çocuklar */}
        {isExpanded && hasChildren && (
          <div>
            {dept.children.map(child => (
              <DeptNode key={child.id} dept={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🏢 Organizasyon Şeması
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Departman hiyerarşisi ve çalışan dağılımı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            Tümünü Aç
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            Tümünü Kapat
          </button>
          <button
            onClick={() => openCreateForm()}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Departman Ekle
          </button>
          <Link
            href="/dashboard/admin/setup"
            className="px-3 py-1.5 text-xs border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Kurulum Sihirbazı
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Sol: Ağaç Görünümü */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 min-h-[500px]">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Building2 className="w-12 h-12 mb-3" />
              <p className="text-sm">Henüz departman tanımlanmamış.</p>
              <button
                onClick={() => openCreateForm()}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                İlk Departmanı Oluştur
              </button>
            </div>
          ) : (
            <div className="space-y-0.5 group">
              {tree.map(dept => (
                <DeptNode key={dept.id} dept={dept} />
              ))}
            </div>
          )}
        </div>

        {/* Sağ: Detay Paneli */}
        {selectedDept && !showForm && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">{selectedDept.name}</h3>
              <button onClick={() => setSelectedDept(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Kod:</span>
                <span className="text-gray-900 dark:text-white">{selectedDept.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seviye:</span>
                <span className="text-gray-900 dark:text-white">{selectedDept.level}</span>
              </div>
              {selectedDept.parent && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Üst Birim:</span>
                  <span className="text-gray-900 dark:text-white">{selectedDept.parent.name}</span>
                </div>
              )}
              {selectedDept.manager && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Yönetici:</span>
                  <span className="text-gray-900 dark:text-white">{selectedDept.manager.name}</span>
                </div>
              )}
            </div>

            {/* Kullanıcılar */}
            {selectedDept.users?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Çalışanlar ({selectedDept.users.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedDept.users.map((u: any) => (
                    <div key={u.id} className="text-xs p-1.5 bg-gray-50 dark:bg-gray-900 rounded">
                      <span className="font-medium text-gray-900 dark:text-white">{u.name}</span>
                      <span className="text-gray-400 ml-1">({u.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pozisyonlar */}
            {selectedDept.positions?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Pozisyonlar ({selectedDept.positions.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedDept.positions.map((p: any) => (
                    <div key={p.id} className="text-xs p-1.5 bg-gray-50 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300">
                      {p.title} <span className="text-gray-400">({p.code})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aksiyon butonları */}
            <div className="flex gap-2 pt-2 border-t dark:border-gray-700">
              <button
                onClick={() => openEditForm(selectedDept)}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Düzenle
              </button>
              <button
                onClick={() => openCreateForm(selectedDept.id)}
                className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Alt Ekle
              </button>
              <button
                onClick={() => handleDelete(selectedDept.id)}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Sağ: Form Paneli */}
        {showForm && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">
                {formMode === 'create' ? 'Yeni Departman' : 'Departman Düzenle'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ad *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kod *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="DEPT-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Yönetici</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData(prev => ({ ...prev, managerId: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seçiniz</option>
                  {allUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.code}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {formMode === 'create' ? 'Oluştur' : 'Güncelle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
