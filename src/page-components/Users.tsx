'use client'
import { useEffect, useMemo, useState } from 'react';
import { Search, Download, UserCircle2, Building2, Shield, X, PencilLine, UserPlus, Users as UsersIcon, Mail, Trash2, Key } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useDepartments, useUsers } from '@/lib/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type EditableUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  role_name?: string | null;
  status?: string | null;
};

export function Users() {
  const { organizationId, user } = useAuth();
  const { users, loading, refetchUsers } = useUsers(organizationId);
  const { departments } = useDepartments();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Set password state
  const [settingPasswordFor, setSettingPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  // Pending invitations state
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchPendingInvitations = async () => {
    if (!organizationId) return;
    setLoadingInvitations(true);
    try {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());
      setPendingInvitations(data ?? []);
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    fetchPendingInvitations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !organizationId) return;
    setInviteLoading(true);
    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          organizationId,
          invitedBy: user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar invitación.');

      if (data.existingUser && data.inviteLink) {
        await navigator.clipboard.writeText(data.inviteLink).catch(() => {});
        toast.info('El usuario ya tiene cuenta. Enlace copiado al portapapeles.', { duration: 6000 });
      } else {
        toast.success('Invitación enviada a ' + inviteEmail.trim());
      }

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('employee');
      fetchPendingInvitations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!settingPasswordFor || !newPassword.trim()) return;
    if (newPassword.length < 8) { toast.error('Mínimo 8 caracteres.'); return; }
    setSettingPassword(true);
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: settingPasswordFor, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al establecer contraseña.');
      toast.success('Contraseña actualizada.');
      setSettingPasswordFor(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSettingPassword(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setRevokingId(id);
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast.success('Invitación revocada.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRevokingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.departments?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment = departmentFilter === 'all' || user.department_id === departmentFilter;
      const matchesRole = roleFilter === 'all' || (user.role_name || 'employee') === roleFilter;
      const matchesStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;

      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });
  }, [departmentFilter, roleFilter, searchQuery, statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role_name === 'admin').length;
    const active = users.filter((u) => (u.status || 'active') === 'active').length;
    return { total, admins, active };
  }, [users]);

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      toast.info('No hay usuarios para exportar.');
      return;
    }

    const rows = filteredUsers.map((user) => ({
      nombre: user.full_name || '',
      email: user.email || '',
      cargo: user.job_title || '',
      departamento: user.departments?.name || '',
      rol: user.role_name || 'employee',
      estado: user.status || 'active',
    }));

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exportación CSV completada.');
  };

  const openEditModal = (user: EditableUser) => {
    setEditingUser({
      id: user.id,
      full_name: user.full_name || '',
      email: user.email || '',
      job_title: user.job_title || '',
      department_id: user.department_id || '',
      role_name: user.role_name || 'employee',
      status: user.status || 'active',
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    // Verificar que el usuario pertenece a la organización actual
    const belongsToOrg = users.some((u) => u.id === editingUser.id);
    if (!belongsToOrg) {
      toast.error('No tienes permisos para editar este usuario.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        job_title: editingUser.job_title?.trim() || null,
        department_id: editingUser.department_id || null,
        role_name: editingUser.role_name || 'employee',
        status: editingUser.status || 'active',
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);
      if (error) throw error;

      await refetchUsers?.();
      setEditingUser(null);
      toast.success('Usuario actualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Directorio de usuarios</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#787774]">
            Filtra, exporta y actualiza los roles o departamentos de los miembros del sistema.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invitar miembro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-900 dark:bg-[#242424] dark:text-[#E8E8E6]">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : stats.total}</p>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Usuarios totales</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-600 dark:bg-[#242424] dark:text-indigo-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : stats.admins}</p>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Administradores</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-600 dark:bg-[#242424] dark:text-emerald-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : stats.active}</p>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Usuarios activos</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por nombre, email, rol o departamento..."
            className="pl-9"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
        >
          <option value="all">Todos los deptos</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="approver">Aprobador</option>
          <option value="employee">Empleado</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#242424]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-gray-50/60 dark:bg-[#1D1D1D]">
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Usuario</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Cargo</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Departamento</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Rol</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Estado</th>
                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#787774]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                        <UsersIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="font-medium text-gray-900 dark:text-[#E8E8E6] text-sm">No hay usuarios</p>
                      <p className="text-xs text-gray-400 dark:text-[#555]">Invita miembros a tu organización.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.id}`}
                          alt={user.full_name || 'Usuario'}
                          className="h-10 w-10 rounded-full border border-gray-200 dark:border-[#3A3A3A]"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{user.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-500 dark:text-[#787774]">{user.email || 'Sin correo'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-[#C8C8C6]">{user.job_title || 'Colaborador'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-[#C8C8C6]">{user.departments?.name || 'General'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role_name === 'admin' ? 'error' : user.role_name === 'approver' ? 'warning' : 'neutral'} className="capitalize">
                        {user.role_name || 'employee'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={(user.status || 'active') === 'active' ? 'success' : 'neutral'} className="capitalize">
                        {user.status || 'active'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                        <PencilLine className="mr-2 h-4 w-4" />
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

      {/* Pending Invitations */}
      {!loadingInvitations && pendingInvitations.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#242424]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2D2D2D]">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500 dark:text-[#787774]" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Invitaciones pendientes</h2>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5">{pendingInvitations.length}</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#1D1D1D] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-gray-400 dark:text-[#555]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{inv.email}</p>
                    <p className="text-xs text-gray-500 dark:text-[#787774]">
                      Expira {new Date(inv.expires_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={inv.role === 'admin' ? 'error' : inv.role === 'approver' ? 'warning' : 'neutral'} className="capitalize">
                    {inv.role === 'admin' ? 'Administrador' : inv.role === 'approver' ? 'Aprobador' : 'Empleado'}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    disabled={revokingId === inv.id}
                    className="p-1.5 text-gray-400 dark:text-[#555] hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
                    title="Revocar invitación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#242424]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Invitar miembro</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                  La invitación expirará en 7 días.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteRole('employee'); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-[#555] dark:hover:bg-[#333] dark:hover:text-[#C8C8C6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Email del nuevo miembro</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Rol</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
                >
                  <option value="admin">Administrador</option>
                  <option value="approver">Aprobador</option>
                  <option value="employee">Empleado</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteRole('employee'); }} disabled={inviteLoading}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="bg-black text-white hover:bg-gray-800"
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim()}
              >
                {inviteLoading ? 'Enviando...' : 'Enviar invitación'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#242424]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Editar usuario</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                  Ajusta rol, estado y departamento sin salir del directorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-[#555] dark:hover:bg-[#333] dark:hover:text-[#C8C8C6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Nombre</label>
                <Input value={editingUser.full_name || ''} disabled />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Correo</label>
                <Input value={editingUser.email || ''} disabled />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Cargo</label>
                <Input
                  value={editingUser.job_title || ''}
                  onChange={(event) => setEditingUser((current) => (current ? { ...current, job_title: event.target.value } : current))}
                  placeholder="Ej. Coordinador de laboratorio"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Departamento</label>
                <select
                  value={editingUser.department_id || ''}
                  onChange={(event) => setEditingUser((current) => (current ? { ...current, department_id: event.target.value } : current))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
                >
                  <option value="">General</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Rol</label>
                <select
                  value={editingUser.role_name || 'employee'}
                  onChange={(event) => setEditingUser((current) => (current ? { ...current, role_name: event.target.value } : current))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
                >
                  <option value="employee">Empleado</option>
                  <option value="approver">Aprobador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Estado</label>
                <select
                  value={editingUser.status || 'active'}
                  onChange={(event) => setEditingUser((current) => (current ? { ...current, status: event.target.value } : current))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSettingPasswordFor(editingUser.id); setNewPassword(''); }}
              >
                <Key className="mr-2 h-4 w-4" />
                Establecer contraseña
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setEditingUser(null)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={handleSaveUser} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {settingPasswordFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#242424] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6] mb-1">Establecer contraseña</h3>
            <p className="text-sm text-gray-500 dark:text-[#787774] mb-4">
              La nueva contraseña reemplazará la actual del usuario.
            </p>
            <div className="space-y-4">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setSettingPasswordFor(null); setNewPassword(''); }}
                  disabled={settingPassword}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-black text-white hover:bg-gray-800"
                  onClick={handleSetPassword}
                  disabled={settingPassword || !newPassword.trim()}
                >
                  {settingPassword ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
