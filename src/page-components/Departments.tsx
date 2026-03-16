'use client'
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, UserCircle2, MoreHorizontal, X, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useDepartments, useResources, useUsers } from '@/lib/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { getCatalogVisibility } from '@/lib/resourceVisibility';

type Tab = 'lista' | 'recursos';

export function Departments() {
  const router = useRouter();
  const { user } = useAuth();
  const { departments, loading, refetchDepartments } = useDepartments();
  const { resources } = useResources();
  const { users: orgUsers } = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');
  const [newManagerIds, setNewManagerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>('lista');

  const filteredDepartments = useMemo(() => {
    return departments.filter(dept =>
      dept.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [departments, searchQuery]);

  const resourcesByDepartment = useMemo(() => {
    const map: Record<string, typeof resources> = {};
    for (const dept of departments) {
      map[dept.id] = resources.filter((r: { department_id?: string }) => r.department_id === dept.id);
    }
    return map;
  }, [departments, resources]);

  const persistDepartmentManagers = async (departmentId: string, leaderId: string, managerIds: string[]) => {
    const finalIds = Array.from(new Set([leaderId, ...managerIds].filter(Boolean)));
    await supabase.from('department_managers').delete().eq('department_id', departmentId);
    if (finalIds.length > 0) {
      const { error: managersError } = await supabase.from('department_managers').insert(
        finalIds.map((userId) => ({
          department_id: departmentId,
          user_id: userId,
          is_primary: userId === leaderId,
        })),
      );
      if (managersError) throw managersError;
    }
  };

  const resetDepartmentForm = () => {
    setNewName('');
    setNewLeaderId('');
    setNewManagerIds([]);
    setEditingDepartment(null);
    setError(null);
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setSaving(true);
    setError(null);
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) throw new Error('No se encontró la organización.');
      const payload: { name: string; organization_id: string; leader_id?: string } = {
        name: newName.trim(),
        organization_id: profile.organization_id,
      };
      if (newLeaderId.trim()) payload.leader_id = newLeaderId.trim();
      if (editingDepartment?.id) {
        const { error: err } = await supabase.from('departments').update(payload).eq('id', editingDepartment.id);
        if (err) throw err;
        await persistDepartmentManagers(editingDepartment.id, newLeaderId.trim(), newManagerIds);
      } else {
        const { data: createdRows, error: err } = await supabase.from('departments').insert(payload).select('id').limit(1);
        if (err) throw err;
        const departmentId = createdRows?.[0]?.id;
        if (departmentId) {
          await persistDepartmentManagers(departmentId, newLeaderId.trim(), newManagerIds);
        }
      }
      resetDepartmentForm();
      setModalOpen(false);
      refetchDepartments?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el departamento.');
    } finally {
      setSaving(false);
    }
  };

  const leaderName = (dept: { profiles?: { full_name?: string } | { full_name?: string }[] | null }) => {
    const p = dept.profiles;
    const name = Array.isArray(p) ? p[0]?.full_name : (p && typeof p === 'object' && 'full_name' in p ? p.full_name : null);
    return name || '—';
  };

  const openEditDepartment = (dept: any) => {
    setEditingDepartment(dept);
    setNewName(dept.name || '');
    setNewLeaderId(dept.leader_id || dept.managers?.find((manager: any) => manager.is_primary)?.user_id || '');
    setNewManagerIds((dept.managers || []).map((manager: any) => manager.user_id));
    setModalOpen(true);
    setError(null);
  };

  const toggleManager = (userId: string) => {
    setNewManagerIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const statsByDepartment = useMemo(() => {
    return departments.reduce<Record<string, { users: number; restricted: number; shared: number }>>((acc, dept) => {
      const deptUsers = orgUsers.filter((u: { department_id?: string }) => u.department_id === dept.id).length;
      const deptResources = resourcesByDepartment[dept.id] ?? [];
      const restricted = deptResources.filter((r: any) => getCatalogVisibility(r) === 'restricted').length;
      const shared = deptResources.filter((r: any) => getCatalogVisibility(r) !== 'restricted').length;
      acc[dept.id] = { users: deptUsers, restricted, shared };
      return acc;
    }, {});
  }, [departments, orgUsers, resourcesByDepartment]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Departamentos</h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">Organiza los recursos y usuarios por áreas de la empresa.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Departamento
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-[#3A3A3A]">
        <button
          type="button"
          onClick={() => setTab('lista')}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'lista' ? "border-gray-900 text-gray-900 dark:text-[#E8E8E6]" : "border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]")}
        >
          Lista de departamentos
        </button>
        <button
          type="button"
          onClick={() => setTab('recursos')}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === 'recursos' ? "border-gray-900 text-gray-900 dark:text-[#E8E8E6]" : "border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]")}
        >
          Recursos por departamento
        </button>
      </div>

      {/* FILTROS Y CONTROLES */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
            <input
              type="text"
              placeholder="Buscar departamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow shadow-sm placeholder:text-gray-400 dark:placeholder:text-[#555]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Departamentos</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{departments.length}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Áreas activas en la organización</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Recursos restringidos</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
            {resources.filter((r: any) => getCatalogVisibility(r) === 'restricted').length}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Visibles para un departamento concreto</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Encargados</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
            {departments.filter((dept: any) => Boolean(dept.leader_id)).length}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Pueden aprobar solicitudes del área</p>
        </Card>
      </div>

      {/* Table - Lista */}
      {tab === 'lista' && (
        <div className="bg-white dark:bg-[#242424] rounded-2xl border border-gray-200 dark:border-[#3A3A3A] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-[#1D1D1D] border-b border-gray-200 dark:border-[#3A3A3A]">
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Departamento</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Encargado de recursos</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Cobertura</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">Cargando departamentos...</td></tr>
                ) : filteredDepartments.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">No se encontraron departamentos.</td></tr>
                ) : (
                  filteredDepartments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] group-hover:text-black dark:group-hover:text-white transition-colors">{dept.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span className="text-sm text-gray-600 dark:text-[#AAAAAA] flex items-center gap-1.5">
                            <UserCircle2 className="w-4 h-4 text-gray-400 dark:text-[#555]" />
                            {leaderName(dept)}
                          </span>
                          {(dept.managers || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {(dept.managers || []).slice(0, 4).map((manager: any) => (
                                <span key={manager.user_id} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-[#2A2A2A] dark:text-[#AAAAAA]">
                                  {manager.profiles?.full_name || 'Encargado'}
                                </span>
                              ))}
                              {(dept.managers || []).length > 4 && (
                                <span className="text-[11px] text-gray-400 dark:text-[#555]">+{dept.managers.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral">{statsByDepartment[dept.id]?.users || 0} usuario(s)</Badge>
                          <Badge variant="warning">{statsByDepartment[dept.id]?.restricted || 0} restringido(s)</Badge>
                          <Badge variant="success">{statsByDepartment[dept.id]?.shared || 0} compartido(s)</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="success" className="font-medium">Activo</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]" onClick={() => openEditDepartment(dept)}>
                          <PencilLine className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recursos por departamento */}
      {tab === 'recursos' && (
        <div className="space-y-4">
          {filteredDepartments.length === 0 ? (
            <p className="text-gray-500 dark:text-[#787774] text-sm py-8 text-center">No hay departamentos.</p>
          ) : (
            filteredDepartments.map((dept) => {
              const deptResources = resourcesByDepartment[dept.id] ?? [];
              const restrictedResources = deptResources.filter((r: any) => getCatalogVisibility(r) === 'restricted');
              const sharedResources = deptResources.filter((r: any) => getCatalogVisibility(r) !== 'restricted');
              return (
                <Card key={dept.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-[#E8E8E6]">{dept.name}</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                        {restrictedResources.length} recurso(s) restringido(s) para esta área · {sharedResources.length} compartido(s)
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-[#787774]">{deptResources.length} recurso(s)</span>
                  </div>
                  {deptResources.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-[#787774]">Sin recursos asignados.</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Restringidos al departamento</p>
                        {restrictedResources.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-[#787774]">Este departamento no tiene recursos exclusivos todavía.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {restrictedResources.slice(0, 8).map((r: any) => (
                              <button key={r.id} type="button" onClick={() => router.push(`/recursos/${r.id}`)} className="px-2 py-1 rounded-md bg-[#FEF4E8] dark:bg-[#3A2B1D] text-xs font-medium text-[#B26B1B] dark:text-[#F5C78F]">
                                {r.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Compartidos o visibles más allá del área</p>
                        {sharedResources.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-[#787774]">No hay recursos compartidos asignados a esta área.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {sharedResources.slice(0, 8).map((r: any) => (
                              <button key={r.id} type="button" onClick={() => router.push(`/recursos/${r.id}`)} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-[#2A2A2A] hover:bg-gray-200 dark:hover:bg-[#333] text-xs font-medium text-gray-700 dark:text-[#C8C8C6]">
                                {r.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#3A3A3A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">{editingDepartment ? 'Editar departamento' : 'Nuevo Departamento'}</h3>
              <button type="button" onClick={() => { setModalOpen(false); resetDepartmentForm(); }} className="p-1 rounded-lg text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#AAAAAA] hover:bg-gray-100 dark:hover:bg-[#333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDepartment} className="p-4 space-y-4">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Nombre *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Tecnología, RRHH" required className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Encargado de recursos (opcional)</label>
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] font-medium"
                >
                  <option value="">Sin asignar</option>
                  {orgUsers.map((u: { id: string; full_name?: string }) => (
                    <option key={u.id} value={u.id}>{u.full_name ?? u.id}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 dark:text-[#555] mt-0.5">Responsable principal del departamento. Se conserva también en `leader_id`.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-2">Encargados adicionales</label>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-[#3A3A3A] dark:bg-[#1D1D1D]">
                  {orgUsers.map((u: { id: string; full_name?: string; email?: string }) => {
                    const checked = newManagerIds.includes(u.id) || newLeaderId === u.id;
                    return (
                      <label key={u.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-[#2A2A2A]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleManager(u.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-gray-800 dark:text-[#E8E8E6]">{u.full_name ?? u.id}</span>
                          <span className="text-xs text-gray-500 dark:text-[#787774]">{u.email || 'Sin correo'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-[#555] mt-1">
                  Estos usuarios podrán gestionar solicitudes del departamento y marcar recursos del área como uso interno o no usable.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetDepartmentForm(); }}>Cancelar</Button>
                <Button type="submit" variant="primary" className="bg-black text-white" disabled={saving}>{saving ? 'Guardando…' : editingDepartment ? 'Guardar cambios' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
