'use client'
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ChevronRight, X, Package, Calendar, Users, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useDepartments, useLocations, useResources, useUsers } from '@/lib/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type TabLoc = 'almacenamiento' | 'reservables';
type NewLocationKind = 'storage' | 'reservable';

export function Locations() {
  const router = useRouter();
  const { user } = useAuth();
  const { locations, loading, refetchLocations } = useLocations();
  const { resources } = useResources();
  const { departments } = useDepartments();
  const { users: orgUsers } = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<TabLoc>('almacenamiento');
  const [modalOpen, setModalOpen] = useState(false);
  const [newKind, setNewKind] = useState<NewLocationKind>('storage');
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'warehouse' | 'classroom' | 'office'>('classroom');
  const [newDescription, setNewDescription] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newPrimaryManagerId, setNewPrimaryManagerId] = useState('');
  const [newManagerIds, setNewManagerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageLocations = useMemo(() => locations.filter((l: { is_reservable?: boolean }) => !l.is_reservable), [locations]);
  const reservableLocations = useMemo(() => locations.filter((l: { is_reservable?: boolean }) => l.is_reservable), [locations]);

  const filteredStorage = useMemo(() => {
    return storageLocations.filter((loc: { name?: string }) =>
      loc.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [storageLocations, searchQuery]);

  const filteredReservable = useMemo(() => {
    return reservableLocations.filter(
      (loc: { name?: string; description?: string }) =>
        loc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.description && loc.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [reservableLocations, searchQuery]);

  const resourcesByLocation = useMemo(() => {
    const map: Record<string, typeof resources> = {};
    for (const loc of locations) {
      map[loc.id] = resources.filter((r: { location_id?: string }) => r.location_id === loc.id);
    }
    return map;
  }, [locations, resources]);

  const resetLocationForm = () => {
    setNewKind('storage');
    setEditingLocation(null);
    setNewName('');
    setNewType('classroom');
    setNewDescription('');
    setNewCapacity('');
    setNewDepartmentId('');
    setNewPrimaryManagerId('');
    setNewManagerIds([]);
    setError(null);
  };

  const persistLocationManagers = async (locationId: string, primaryManagerId: string, managerIds: string[]) => {
    const finalIds = Array.from(new Set([primaryManagerId, ...managerIds].filter(Boolean)));
    await supabase.from('location_managers').delete().eq('location_id', locationId);
    if (finalIds.length > 0) {
      const { error: managerError } = await supabase.from('location_managers').insert(
        finalIds.map((userId) => ({
          location_id: locationId,
          user_id: userId,
          is_primary: userId === primaryManagerId,
        })),
      );
      if (managerError) throw managerError;
    }
  };

  const toggleManager = (userId: string) => {
    setNewManagerIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const openEditLocation = (location: any) => {
    setEditingLocation(location);
    setNewKind(location.is_reservable ? 'reservable' : 'storage');
    setNewName(location.name || '');
    setNewType((location.type as 'warehouse' | 'classroom' | 'office') || 'classroom');
    setNewDescription(location.description || '');
    setNewCapacity(location.capacity ? String(location.capacity) : '');
    setNewDepartmentId(location.department_id || '');
    setNewPrimaryManagerId(location.managers?.find((manager: any) => manager.is_primary)?.user_id || '');
    setNewManagerIds((location.managers || []).map((manager: any) => manager.user_id));
    setModalOpen(true);
    setError(null);
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setSaving(true);
    setError(null);
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) throw new Error('No se encontró la organización.');
      const payload: Record<string, unknown> = {
        name: newName.trim(),
        type: newType,
        organization_id: profile.organization_id,
        is_reservable: newKind === 'reservable',
        department_id: newDepartmentId || null,
      };
      if (newKind === 'reservable') {
        if (newDescription.trim()) payload.description = newDescription.trim();
        if (newCapacity.trim() && !Number.isNaN(Number(newCapacity))) payload.capacity = Number(newCapacity);
      }
      if (editingLocation?.id) {
        const { error: err } = await supabase.from('locations').update(payload).eq('id', editingLocation.id);
        if (err) throw err;
        await persistLocationManagers(editingLocation.id, newPrimaryManagerId, newManagerIds);
      } else {
        const { data: createdRows, error: err } = await supabase.from('locations').insert(payload).select('id').limit(1);
        if (err) throw err;
        const locationId = createdRows?.[0]?.id;
        if (locationId) {
          await persistLocationManagers(locationId, newPrimaryManagerId, newManagerIds);
        }
      }
      resetLocationForm();
      setModalOpen(false);
      refetchLocations?.();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error al crear.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (t: string) => (t === 'warehouse' ? 'Almacén' : t === 'classroom' ? 'Aula' : t === 'office' ? 'Oficina' : t || '—');
  const reservableUsageLabel = (t: string) => (t === 'classroom' ? 'Espacio académico' : t === 'office' ? 'Espacio administrativo' : 'Espacio de uso');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Ubicaciones</h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">
            Ubicaciones de almacenamiento (donde están los recursos) y espacios que se pueden reservar (salas, aulas).
          </p>
        </div>
        <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nueva
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#242424] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Almacenamiento</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{storageLocations.length}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Sitios donde viven y se devuelven recursos</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#242424] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Espacios de uso</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{reservableLocations.length}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Laboratorios, canchas, aulas o salas reservables</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#242424] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Inventario ubicado</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{resources.length}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Recursos enlazados a una ubicación del sistema</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('almacenamiento')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            tab === 'almacenamiento' ? 'border-gray-900 text-gray-900 dark:text-[#E8E8E6]' : 'border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]'
          )}
        >
          <Package className="w-4 h-4" />
          Almacenamiento ({storageLocations.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reservables')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            tab === 'reservables' ? 'border-gray-900 text-gray-900 dark:text-[#E8E8E6]' : 'border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]'
          )}
        >
          <Calendar className="w-4 h-4" />
          Espacios reservables ({reservableLocations.length})
        </button>
      </div>

      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
        <input
          type="text"
          placeholder={tab === 'almacenamiento' ? 'Buscar ubicación de almacenamiento...' : 'Buscar espacio reservable...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-[#555]"
        />
      </div>

      {tab === 'almacenamiento' && (
        <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50/50 dark:bg-[#1D1D1D]">
            <p className="text-sm text-gray-600 dark:text-[#AAAAAA]">
              <strong>Ubicaciones de almacenamiento:</strong> donde se guardan los recursos. Cada recurso puede tener una; así el usuario sabe dónde está y dónde devolverlo.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-[#1D1D1D] border-b border-gray-200 dark:border-[#3A3A3A]">
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Ubicación</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Recursos guardados aquí</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                {loading ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">Cargando...</td></tr>
                ) : filteredStorage.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">No hay ubicaciones de almacenamiento.</td></tr>
                ) : (
                  filteredStorage.map((loc: { id: string; name?: string; type?: string }) => {
                    const locResources = resourcesByLocation[loc.id] ?? [];
                    return (
                      <tr key={loc.id} className="hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{loc.name}</p>
                          <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">{typeLabel(loc.type ?? '')}</p>
                        </td>
                        <td className="px-6 py-4">
                          {locResources.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-[#555]">Ningún recurso asignado</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {locResources.slice(0, 5).map((r: { id: string; name: string }) => (
                                <button key={r.id} type="button" onClick={() => router.push(`/recursos/${r.id}`)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-[#2A2A2A] hover:bg-gray-200 dark:hover:bg-[#333] text-xs font-medium text-gray-700 dark:text-[#C8C8C6]">
                                  {r.name}<ChevronRight className="w-3 h-3" />
                                </button>
                              ))}
                              {locResources.length > 5 && <span className="text-xs text-gray-500 dark:text-[#787774]">+{locResources.length - 5}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]" onClick={() => openEditLocation(loc)}>
                            <PencilLine className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reservables' && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>Espacios de uso / reservables:</strong> laboratorios, canchas, aulas o salas que se pueden usar o reservar. No son bodegas; describen dónde ocurre la actividad.
            </p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-[#787774]">Cargando...</div>
          ) : filteredReservable.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-[#787774] rounded-2xl border border-dashed border-gray-200 dark:border-[#3A3A3A] bg-gray-50/50 dark:bg-[#1D1D1D]">
              No hay espacios reservables. Crea uno con &quot;Nueva&quot; y elige &quot;Espacio reservable&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReservable.map((loc: { id: string; name?: string; type?: string; description?: string; capacity?: number; departments?: { name?: string } | null; managers?: any[] }) => (
                <div
                  key={loc.id}
                  className="rounded-2xl bg-white dark:bg-[#242424] p-5 shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#2A2A2A] border border-gray-200 dark:border-[#3A3A3A] flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-600 dark:text-[#AAAAAA]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-[#E8E8E6]">{loc.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-[#787774]">{typeLabel(loc.type ?? '')} · {reservableUsageLabel(loc.type ?? '')}</p>
                        {loc.departments?.name && (
                          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Uso restringido a {loc.departments.name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {loc.description && (
                    <p className="text-sm text-gray-600 dark:text-[#AAAAAA] mb-3 line-clamp-3">{loc.description}</p>
                  )}
                  {loc.capacity != null && (
                    <p className="text-xs text-gray-500 dark:text-[#787774] flex items-center gap-1 mb-3">
                      <Users className="w-4 h-4" /> Capacidad: {loc.capacity} persona{loc.capacity !== 1 ? 's' : ''}
                    </p>
                  )}
                  {(loc.managers || []).length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {(loc.managers || []).slice(0, 3).map((manager: any) => (
                        <span key={manager.user_id} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-[#2A2A2A] dark:text-[#AAAAAA]">
                          {manager.profiles?.full_name || 'Encargado'}
                        </span>
                      ))}
                    </div>
                  )}
                  <Button variant="secondary" size="sm" className="mt-auto w-full bg-gray-50 dark:bg-[#1D1D1D]">
                    Usar / reservar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sticky top-0 bg-white dark:bg-[#242424]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">{editingLocation ? 'Editar ubicación o espacio' : 'Nueva ubicación o espacio'}</h3>
              <button type="button" onClick={() => { setModalOpen(false); resetLocationForm(); }} className="p-1 rounded-lg text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#AAAAAA] hover:bg-gray-100 dark:hover:bg-[#333]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLocation} className="p-4 space-y-4">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-2">¿Para qué es?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKind('storage')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      newKind === 'storage' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                    )}
                  >
                    <Package className="w-4 h-4" /> Almacenar recursos
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKind('reservable')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      newKind === 'reservable' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                    )}
                  >
                    <Calendar className="w-4 h-4" /> Espacio reservable
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Nombre *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={newKind === 'storage' ? 'Ej. Almacén principal, Aula 101' : 'Ej. Sala de juntas, Aula 3B'} required className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Tipo</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as 'warehouse' | 'classroom' | 'office')} className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] font-medium">
                  {newKind === 'storage' ? (
                    <>
                      <option value="warehouse">Almacén</option>
                      <option value="office">Oficina</option>
                      <option value="classroom">Aula con inventario</option>
                    </>
                  ) : (
                    <>
                      <option value="classroom">Aula / laboratorio</option>
                      <option value="office">Sala / oficina</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Departamento restringido</label>
                <select value={newDepartmentId} onChange={(e) => setNewDepartmentId(e.target.value)} className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] font-medium">
                  <option value="">Compartido / institucional</option>
                  {departments.map((department: any) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-400 dark:text-[#555]">Si eliges un departamento, este espacio se entiende como de uso interno para esa área.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Encargado principal</label>
                <select value={newPrimaryManagerId} onChange={(e) => setNewPrimaryManagerId(e.target.value)} className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] font-medium">
                  <option value="">Sin asignar</option>
                  {orgUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name ?? u.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-2">Encargados adicionales</label>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-[#3A3A3A] dark:bg-[#1D1D1D]">
                  {orgUsers.map((u: any) => {
                    const checked = newManagerIds.includes(u.id) || newPrimaryManagerId === u.id;
                    return (
                      <label key={u.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-[#2A2A2A]">
                        <input type="checkbox" checked={checked} onChange={() => toggleManager(u.id)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-gray-800 dark:text-[#E8E8E6]">{u.full_name ?? u.id}</span>
                          <span className="text-xs text-gray-500 dark:text-[#787774]">{u.email || 'Sin correo'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-gray-400 dark:text-[#555]">Estos usuarios pueden gestionar solicitudes y uso del espacio, como laboratorios, canchas o salones.</p>
              </div>
              {newKind === 'reservable' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Descripción del espacio</label>
                    <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Ej. Sala con pizarra y proyector, buena iluminación..." className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] min-h-[80px]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Capacidad (personas)</label>
                    <Input type="number" min="1" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} placeholder="Ej. 20" className="w-full" />
                  </div>
                </>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetLocationForm(); }}>Cancelar</Button>
                <Button type="submit" variant="primary" className="bg-black text-white" disabled={saving}>{saving ? 'Guardando…' : editingLocation ? 'Guardar cambios' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
