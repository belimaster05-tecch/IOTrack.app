'use client'
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  Send,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useRequests, useLoans, useResources, useUsers } from '@/lib/hooks';
import { supabase } from '@/lib/supabase/client';
import { getCatalogVisibility } from '@/lib/resourceVisibility';
import { formatTimeRange } from '@/lib/scheduling';
import { cn } from '@/lib/utils';

function daysRemaining(dueDate: string): { label: string; color: string } {
  const today = new Date().toISOString().split('T')[0];
  const diff = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d vencido`, color: 'text-red-500 dark:text-red-400' };
  if (diff === 0) return { label: 'Vence hoy', color: 'text-amber-500 dark:text-amber-400' };
  if (diff <= 3) return { label: `${diff}d restantes`, color: 'text-amber-500 dark:text-amber-400' };
  return { label: `${diff}d`, color: 'text-gray-400 dark:text-[#555]' };
}

export function MyResources() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id || '');
  const { requests, loading: loadingRequests } = useRequests();
  const { loans, loading: loadingLoans } = useLoans();
  const { resources, loading: loadingResources } = useResources();
  const { users: orgUsers } = useUsers(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'loans' | 'consumables' | 'assigned' | 'lending'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'overdue'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    requests: false,
    loans: false,
    consumables: false,
    assigned: false,
    lending: false,
  });
  const [consumableActivity, setConsumableActivity] = useState<any[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState(true);

  // Personal lending state
  const [personalLoans, setPersonalLoans] = useState<any[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [lendModal, setLendModal] = useState<{ open: boolean; resource: any | null }>({ open: false, resource: null });
  const [lendUnitId, setLendUnitId] = useState('');
  const [modalUnits, setModalUnits] = useState<any[]>([]);
  const [lendBorrowerId, setLendBorrowerId] = useState('');
  const [lendDueDate, setLendDueDate] = useState('');
  const [lendNotes, setLendNotes] = useState('');
  const [lendSubmitting, setLendSubmitting] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchConsumableActivity = async () => {
      if (!user?.id) {
        setConsumableActivity([]);
        setLoadingConsumables(false);
        return;
      }
      setLoadingConsumables(true);
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('action', 'consumable_checkout')
          .order('created_at', { ascending: false })
          .limit(12);
        setConsumableActivity(data ?? []);
      } finally {
        setLoadingConsumables(false);
      }
    };

    fetchConsumableActivity();
  }, [user?.id]);

  const refreshPersonalLoans = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('loans')
      .select('*, resource_units(id, serial_number, resources(name, sku)), profiles!loans_user_id_fkey(full_name, email)')
      .eq('lender_user_id', user.id)
      .neq('status', 'returned')
      .order('due_date', { ascending: true });
    setPersonalLoans(data ?? []);
  };

  useEffect(() => {
    const fetchPersonalData = async () => {
      if (!user?.id) { setLoadingPersonal(false); return; }
      setLoadingPersonal(true);
      try {
        const { data } = await supabase
          .from('loans')
          .select('*, resource_units(id, serial_number, resources(name, sku)), profiles!loans_user_id_fkey(full_name, email)')
          .eq('lender_user_id', user.id)
          .neq('status', 'returned')
          .order('due_date', { ascending: true });
        setPersonalLoans(data ?? []);
      } finally {
        setLoadingPersonal(false);
      }
    };
    fetchPersonalData();
  }, [user?.id]);

  const openLendModal = async (resource: any) => {
    setLendModal({ open: true, resource });
    setLendBorrowerId('');
    setLendDueDate('');
    setLendNotes('');
    setLendUnitId('');
    const { data } = await supabase
      .from('resource_units')
      .select('id, serial_number')
      .eq('resource_id', resource.id)
      .eq('status', 'available');
    setModalUnits(data ?? []);
    if (data?.length === 1) setLendUnitId(data[0].id);
  };

  const handleLendUnit = async () => {
    if (!lendModal.resource || !lendBorrowerId || !lendDueDate || !user?.id) return;
    setLendSubmitting(true);
    try {
      const { error } = await supabase.from('loans').insert({
        unit_id: lendUnitId || null,
        user_id: lendBorrowerId,
        lender_user_id: user.id,
        start_date: new Date().toISOString().split('T')[0],
        due_date: lendDueDate,
        status: 'active',
        notes: lendNotes || null,
        organization_id: profile?.organization_id,
      });
      if (error) throw error;
      toast.success('Préstamo registrado');
      setLendModal({ open: false, resource: null });
      await refreshPersonalLoans();
    } catch (err: any) {
      toast.error('Error al registrar préstamo: ' + err.message);
    } finally {
      setLendSubmitting(false);
    }
  };

  const handleReturnPersonalLoan = async (loanId: string) => {
    try {
      const { error } = await supabase.from('loans').update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] }).eq('id', loanId);
      if (error) throw error;
      toast.success('Préstamo marcado como devuelto');
      await refreshPersonalLoans();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const myRequests = useMemo(() => requests.filter((r) => r.user_id === user?.id), [requests, user?.id]);
  const myLoans = useMemo(() => loans.filter((l) => l.user_id === user?.id && l.status !== 'returned'), [loans, user?.id]);

  const filteredRequests = useMemo(() => {
    let items = myRequests;
    if (statusFilter !== 'all') {
      items = items.filter((r) => r.status === statusFilter);
    }
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (r) => r.resources?.name?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q)
    );
  }, [myRequests, searchQuery, statusFilter]);

  const filteredLoans = useMemo(() => {
    let items = myLoans;
    if (statusFilter !== 'all') {
      items = items.filter((l) => l.status === statusFilter);
    }
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (l) =>
        l.resource_units?.resources?.name?.toLowerCase().includes(q) ||
        l.resource_units?.serial_number?.toLowerCase().includes(q)
    );
  }, [myLoans, searchQuery, statusFilter]);

  const filteredConsumables = useMemo(() => {
    if (!searchQuery.trim()) return consumableActivity;
    const q = searchQuery.toLowerCase();
    return consumableActivity.filter(
      (entry) =>
        entry.details?.resource_name?.toLowerCase().includes(q) ||
        entry.details?.notes?.toLowerCase().includes(q) ||
        entry.details?.use_location?.toLowerCase().includes(q)
    );
  }, [consumableActivity, searchQuery]);

  const assignedResources = useMemo(() => {
    const fullName = profile?.full_name?.trim().toLowerCase();
    const departmentId = profile?.department_id;

    return resources.filter((resource) => {
      const visibility = getCatalogVisibility(resource);
      const ownerName = resource.owner_name?.trim().toLowerCase();
      const directMatch = Boolean(fullName && ownerName && ownerName === fullName);
      const departmentMatch = visibility === 'restricted' && Boolean(departmentId && resource.department_id === departmentId);
      const fixedAssigned = visibility === 'internal' || resource.ownership_type === 'personal';
      return directMatch || departmentMatch || (fixedAssigned && directMatch);
    });
  }, [profile?.department_id, profile?.full_name, resources]);

  const filteredAssignedResources = useMemo(() => {
    if (!searchQuery.trim()) return assignedResources;
    const q = searchQuery.toLowerCase();
    return assignedResources.filter(
      (resource) =>
        resource.name?.toLowerCase().includes(q) ||
        resource.sku?.toLowerCase().includes(q) ||
        resource.owner_name?.toLowerCase().includes(q)
    );
  }, [assignedResources, searchQuery]);

  const filteredPersonalLoans = useMemo(() => {
    if (!searchQuery.trim()) return personalLoans;
    const q = searchQuery.toLowerCase();
    return personalLoans.filter(
      (loan) =>
        loan.resource_units?.resources?.name?.toLowerCase().includes(q) ||
        loan.resource_units?.serial_number?.toLowerCase().includes(q) ||
        loan.profiles?.full_name?.toLowerCase().includes(q) ||
        loan.profiles?.email?.toLowerCase().includes(q)
    );
  }, [personalLoans, searchQuery]);

  const loading = loadingRequests || loadingLoans || loadingConsumables || loadingResources || loadingPersonal;

  const totalCount =
    filteredRequests.length +
    filteredLoans.length +
    filteredConsumables.length +
    filteredAssignedResources.length +
    filteredPersonalLoans.length;

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const colHeader = (labels: string[], cols: string) => (
    <div className={cn('grid border-b border-black/[0.04] dark:border-white/[0.04] bg-[#FAFAFA] dark:bg-[#161616]', cols)}>
      {labels.map((h, i) => (
        <div
          key={h}
          className={cn(
            'flex items-center gap-1 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-[#555]',
            i === 0 && 'border-r border-black/[0.04] dark:border-white/[0.04]'
          )}
        >
          {h}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">A mi disposición</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
            Revisa tus solicitudes, recursos activos y préstamos personales.
          </p>
        </div>
        <Button
          onClick={() => router.push('/solicitar')}
          variant="primary"
          className="bg-black text-white shrink-0"
        >
          + Solicitar recurso
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-black/[0.06] dark:border-white/[0.06]">
        {(
          [
            { key: 'all', label: 'Todo', count: totalCount },
            { key: 'requests', label: 'Solicitudes', count: filteredRequests.length },
            { key: 'loans', label: 'En uso', count: filteredLoans.length },
            { key: 'consumables', label: 'Consumibles', count: filteredConsumables.length },
            { key: 'assigned', label: 'Asignados', count: filteredAssignedResources.length },
            { key: 'lending', label: 'Préstamos dados', count: filteredPersonalLoans.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors -mb-px',
              activeTab === tab.key
                ? 'border-gray-900 dark:border-[#E8E8E6] text-gray-900 dark:text-[#E8E8E6] font-medium'
                : 'border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#AAAAAA]'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] rounded-[4px] bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.5 font-medium tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Estado filter chip */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors',
              statusFilter !== 'all'
                ? 'border-gray-900 dark:border-[#E8E8E6] bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] font-medium'
                : 'border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#1D1D1D] text-gray-600 dark:text-[#AAAAAA] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            )}
          >
            <Filter className="h-3 w-3" />
            Estado{statusFilter !== 'all' ? `: ${statusFilter}` : ' ▾'}
          </button>
          {filterOpen && (
            <div className="absolute top-9 left-0 z-20 bg-white dark:bg-[#242424] border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-lg py-1 min-w-[160px]">
              {(
                [
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'pending', label: '● Pendiente' },
                  { value: 'approved', label: '● Aprobado' },
                  { value: 'rejected', label: '● Rechazado' },
                  { value: 'active', label: '● En uso' },
                  { value: 'overdue', label: '● Vencido' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setFilterOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors',
                    statusFilter === opt.value ? 'text-gray-900 dark:text-[#E8E8E6] font-medium' : 'text-gray-600 dark:text-[#AAAAAA]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-gray-400 hover:text-gray-600 dark:hover:text-[#AAAAAA] transition-colors"
          >
            × Limpiar filtros
          </button>
        )}

        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-[#444]" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 pr-3 w-52 rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1D1D1D] text-xs text-gray-900 dark:text-[#E8E8E6] placeholder-gray-300 dark:placeholder-[#444] focus:outline-none focus:border-gray-300 dark:focus:border-[#555]"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">

        {/* ── Mis solicitudes ── */}
        {(activeTab === 'all' || activeTab === 'requests') && (
          <div className="bg-white dark:bg-[#1D1D1D] rounded-xl border border-black/[0.06] dark:border-white/[0.05] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('requests')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
            >
              {collapsedSections.requests
                ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />}
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Mis solicitudes</span>
              <span className="text-xs text-gray-400 dark:text-[#555]">{filteredRequests.length}</span>
              <span className="ml-auto" />
            </button>

            {!collapsedSections.requests && (
              <>
                {colHeader(['RECURSO', 'ESTADO', 'FECHA', 'HORARIO'], 'grid-cols-[1fr_140px_120px_100px]')}
                {loading ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Cargando...</p>
                ) : filteredRequests.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Sin registros</p>
                ) : (
                  filteredRequests.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => router.push('/solicitudes')}
                      className="w-full grid grid-cols-[1fr_140px_120px_100px] items-center border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <div className="px-4 py-2.5 border-r border-black/[0.03] dark:border-white/[0.03] min-w-0">
                        <p className="text-sm text-gray-900 dark:text-[#E8E8E6] truncate">{req.resources?.name ?? 'Recurso'}</p>
                        {req.resources?.locations?.name && (
                          <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 truncate">{req.resources.locations.name}</p>
                        )}
                      </div>
                      <div className="px-4 py-2.5">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Pendiente
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />Aprobado
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />Rechazado
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {new Date(req.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {formatTimeRange(req.start_time, req.end_time)}
                      </div>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* ── Recursos en uso ── */}
        {(activeTab === 'all' || activeTab === 'loans') && (
          <div className="bg-white dark:bg-[#1D1D1D] rounded-xl border border-black/[0.06] dark:border-white/[0.05] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('loans')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
            >
              {collapsedSections.loans
                ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />}
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Recursos en uso</span>
              <span className="text-xs text-gray-400 dark:text-[#555]">{filteredLoans.length}</span>
              <span className="ml-auto" />
            </button>

            {!collapsedSections.loans && (
              <>
                {colHeader(['RECURSO', 'ESTADO', 'VENCE', 'DEVOLUCIÓN'], 'grid-cols-[1fr_140px_120px_120px]')}
                {loading ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Cargando...</p>
                ) : filteredLoans.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Sin registros</p>
                ) : (
                  filteredLoans.map((loan) => {
                    const isOverdue = loan.status === 'overdue';
                    const dueToday = loan.due_date === new Date().toISOString().split('T')[0];
                    return (
                      <button
                        key={loan.id}
                        type="button"
                        onClick={() => router.push('/solicitudes')}
                        className="w-full grid grid-cols-[1fr_140px_120px_120px] items-center border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <div className="px-4 py-2.5 border-r border-black/[0.03] dark:border-white/[0.03] min-w-0">
                          <p className="text-sm text-gray-900 dark:text-[#E8E8E6] truncate">
                            {loan.resource_units?.resources?.name ?? 'Recurso'}
                          </p>
                          {loan.resource_units?.serial_number && (
                            <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 truncate">
                              {loan.resource_units.serial_number}
                            </p>
                          )}
                        </div>
                        <div className="px-4 py-2.5">
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />Vencido
                            </span>
                          )}
                          {dueToday && !isOverdue && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Vence hoy
                            </span>
                          )}
                          {loan.status === 'active' && !dueToday && !isOverdue && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />En uso
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                          {loan.due_date
                            ? new Date(loan.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                            : '—'}
                        </div>
                        <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774] truncate">
                          {loan.resource_units?.resources?.locations?.name ?? '—'}
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}

        {/* ── Retiros consumibles ── */}
        {(activeTab === 'all' || activeTab === 'consumables') && (
          <div className="bg-white dark:bg-[#1D1D1D] rounded-xl border border-black/[0.06] dark:border-white/[0.05] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('consumables')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
            >
              {collapsedSections.consumables
                ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />}
              <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Retiros consumibles</span>
              <span className="text-xs text-gray-400 dark:text-[#555]">{filteredConsumables.length}</span>
              <span className="ml-auto" />
            </button>

            {!collapsedSections.consumables && (
              <>
                {colHeader(['CONSUMIBLE', 'UBICACIÓN', 'CANT.', 'FECHA'], 'grid-cols-[1fr_160px_72px_110px]')}
                {loading ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Cargando...</p>
                ) : filteredConsumables.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Sin registros</p>
                ) : (
                  filteredConsumables.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => router.push(`/recursos/${entry.entity_id}`)}
                      className="w-full grid grid-cols-[1fr_160px_72px_110px] items-center border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <div className="px-4 py-2.5 border-r border-black/[0.03] dark:border-white/[0.03] min-w-0">
                        <p className="text-sm text-gray-900 dark:text-[#E8E8E6] truncate">
                          {entry.details?.resource_name ?? 'Consumible'}
                        </p>
                        {entry.details?.notes && (
                          <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 truncate">{entry.details.notes}</p>
                        )}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774] truncate">
                        {entry.details?.use_location ?? '—'}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {entry.details?.quantity ?? 0}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {new Date(entry.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </div>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* ── Mis recursos asignados ── */}
        {(activeTab === 'all' || activeTab === 'assigned') && (
          <div className="bg-white dark:bg-[#1D1D1D] rounded-xl border border-black/[0.06] dark:border-white/[0.05] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('assigned')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
            >
              {collapsedSections.assigned
                ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />}
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Mis recursos asignados</span>
              <span className="text-xs text-gray-400 dark:text-[#555]">{filteredAssignedResources.length}</span>
              <span className="ml-auto" />
            </button>

            {!collapsedSections.assigned && (
              <>
                {colHeader(['RECURSO', 'SKU', 'UBICACIÓN', 'TIPO', 'ACCIÓN'], 'grid-cols-[1fr_110px_160px_80px_84px]')}
                {loading ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Cargando...</p>
                ) : filteredAssignedResources.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Sin registros</p>
                ) : (
                  filteredAssignedResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="w-full grid grid-cols-[1fr_110px_160px_80px_84px] items-center border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/recursos/${resource.id}`)}
                        className="px-4 py-2.5 border-r border-black/[0.03] dark:border-white/[0.03] min-w-0 text-left"
                      >
                        <p className="text-sm text-gray-900 dark:text-[#E8E8E6] truncate">{resource.name}</p>
                        {resource.owner_name && (
                          <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 truncate">{resource.owner_name}</p>
                        )}
                      </button>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {resource.sku ?? '—'}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774] truncate">
                        {resource.locations?.name ?? '—'}
                      </div>
                      <div className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {getCatalogVisibility(resource) === 'internal' ? 'Fijo' : 'Área'}
                        </span>
                      </div>
                      <div className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openLendModal(resource)}
                          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                        >
                          <Send className="h-3 w-3" /> Prestar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* ── Préstamos dados ── */}
        {(activeTab === 'all' || activeTab === 'lending') && (
          <div className="bg-white dark:bg-[#1D1D1D] rounded-xl border border-black/[0.06] dark:border-white/[0.05] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('lending')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
            >
              {collapsedSections.lending
                ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />}
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Préstamos dados</span>
              <span className="text-xs text-gray-400 dark:text-[#555]">{filteredPersonalLoans.length}</span>
              <span className="ml-auto" />
            </button>

            {!collapsedSections.lending && (
              <>
                {colHeader(['RECURSO', 'PRESTADO A', 'VENCE', 'ACCIÓN'], 'grid-cols-[1fr_160px_120px_96px]')}
                {loadingPersonal ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Cargando...</p>
                ) : filteredPersonalLoans.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center text-gray-400 dark:text-[#555]">Sin registros</p>
                ) : (
                  filteredPersonalLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="w-full grid grid-cols-[1fr_160px_120px_96px] items-center border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="px-4 py-2.5 border-r border-black/[0.03] dark:border-white/[0.03] min-w-0">
                        <p className="text-sm text-gray-900 dark:text-[#E8E8E6] truncate">
                          {loan.resource_units?.resources?.name ?? 'Recurso'}
                        </p>
                        {loan.resource_units?.serial_number && (
                          <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 truncate">
                            {loan.resource_units.serial_number}
                          </p>
                        )}
                      </div>
                      <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774] truncate">
                        <span className="flex items-center gap-1">
                          <Users2 className="h-3 w-3 shrink-0" />
                          {loan.profiles?.full_name || loan.profiles?.email || '—'}
                        </span>
                      </div>
                      <div className="px-4 py-2.5">
                        {loan.due_date && (() => {
                          const d = daysRemaining(loan.due_date);
                          return (
                            <span className={cn('text-xs font-medium', d.color)}>
                              {d.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleReturnPersonalLoan(loan.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Devuelto
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Personal loan modal */}
      {lendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Prestar recurso</h2>
              <p className="text-sm text-gray-500 dark:text-[#787774] mt-1">{lendModal.resource?.name}</p>
            </div>
            <div className="space-y-4">
              {modalUnits.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-[#C8C8C6] block mb-1">Unidad a prestar *</label>
                  <select
                    value={lendUnitId}
                    onChange={(e) => setLendUnitId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1D1D1D] text-sm text-gray-900 dark:text-[#E8E8E6] focus:outline-none focus:border-gray-400 dark:focus:border-[#555]"
                  >
                    <option value="">Seleccionar unidad...</option>
                    {modalUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.serial_number}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalUnits.length === 1 && (
                <p className="text-xs text-gray-500 dark:text-[#787774] bg-gray-50 dark:bg-[#1D1D1D] px-3 py-2 rounded-lg">
                  Unidad: <span className="font-mono font-semibold">{modalUnits[0].serial_number}</span>
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#C8C8C6] block mb-1">Prestar a *</label>
                <select
                  value={lendBorrowerId}
                  onChange={(e) => setLendBorrowerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1D1D1D] text-sm text-gray-900 dark:text-[#E8E8E6] focus:outline-none focus:border-gray-400 dark:focus:border-[#555]"
                >
                  <option value="">Seleccionar persona...</option>
                  {orgUsers.filter((u: any) => u.id !== user?.id).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#C8C8C6] block mb-1">Fecha de devolución *</label>
                <input
                  type="date"
                  value={lendDueDate}
                  onChange={(e) => setLendDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1D1D1D] text-sm text-gray-900 dark:text-[#E8E8E6] focus:outline-none focus:border-gray-400 dark:focus:border-[#555]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#C8C8C6] block mb-1">Notas (opcional)</label>
                <textarea
                  value={lendNotes}
                  onChange={(e) => setLendNotes(e.target.value)}
                  placeholder="Motivo, condiciones del préstamo..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1D1D1D] text-sm text-gray-900 dark:text-[#E8E8E6] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-gray-400 dark:focus:border-[#555] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setLendModal({ open: false, resource: null })}
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-[#333] text-sm text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLendUnit}
                disabled={!lendBorrowerId || !lendDueDate || (modalUnits.length > 1 && !lendUnitId) || lendSubmitting}
                className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {lendSubmitting ? 'Registrando...' : 'Confirmar préstamo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
