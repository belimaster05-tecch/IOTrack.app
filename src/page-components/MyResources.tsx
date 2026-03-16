'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  Hash,
  LayoutGrid,
  List,
  MapPin,
  Package,
  PlusCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  UserCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useRequests, useLoans, useResources } from '@/lib/hooks';
import { supabase } from '@/lib/supabase/client';
import { getCatalogVisibility } from '@/lib/resourceVisibility';
import { formatTimeRange } from '@/lib/scheduling';
import { cn } from '@/lib/utils';

const SECTION_ACCENT: Record<string, string> = {
  requests: '#3B82F6',
  loans: '#B0894F',
  consumables: '#8B5CF6',
  assigned: '#10B981',
};

const COLUMN_STYLES = {
  requests: {
    shell: 'bg-white dark:bg-[#242424]',
    card: 'bg-[#F7F7F6] hover:bg-[#F2F2F1] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]',
    accent: 'bg-[#3B82F6]',
    badge: 'bg-white/70 text-[#3159B8] border-white/70 dark:bg-white/10 dark:text-[#A7C0FF] dark:border-white/10',
  },
  loans: {
    shell: 'bg-white dark:bg-[#242424]',
    card: 'bg-[#F7F7F6] hover:bg-[#F2F2F1] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]',
    accent: 'bg-[#B0894F]',
    badge: 'bg-white/70 text-[#8C6632] border-white/70 dark:bg-white/10 dark:text-[#E7C38E] dark:border-white/10',
  },
  consumables: {
    shell: 'bg-white dark:bg-[#242424]',
    card: 'bg-[#F7F7F6] hover:bg-[#F2F2F1] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]',
    accent: 'bg-[#8B5CF6]',
    badge: 'bg-white/70 text-[#6C47C6] border-white/70 dark:bg-white/10 dark:text-[#C4B0FF] dark:border-white/10',
  },
  assigned: {
    shell: 'bg-white dark:bg-[#242424]',
    card: 'bg-[#F7F7F6] hover:bg-[#F2F2F1] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]',
    accent: 'bg-[#F59E0B]',
    badge: 'bg-white/70 text-[#A56B00] border-white/70 dark:bg-white/10 dark:text-[#F7C978] dark:border-white/10',
  },
} as const;

function EmptyColumn({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white/30 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#787774]">
      {text}
    </div>
  );
}

export function MyResources() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id || '');
  const { requests, loading: loadingRequests } = useRequests();
  const { loans, loading: loadingLoans } = useLoans();
  const { resources, loading: loadingResources } = useResources();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    requests: false,
    loans: false,
    consumables: false,
    assigned: false,
  });
  const [consumableActivity, setConsumableActivity] = useState<any[]>([]);
  const [loadingConsumables, setLoadingConsumables] = useState(true);

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

  const myRequests = useMemo(() => requests.filter((r) => r.user_id === user?.id), [requests, user?.id]);
  const myLoans = useMemo(() => loans.filter((l) => l.user_id === user?.id && l.status !== 'returned'), [loans, user?.id]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return myRequests;
    const q = searchQuery.toLowerCase();
    return myRequests.filter(
      (r) => r.resources?.name?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q)
    );
  }, [myRequests, searchQuery]);

  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim()) return myLoans;
    const q = searchQuery.toLowerCase();
    return myLoans.filter(
      (l) =>
        l.resource_units?.resources?.name?.toLowerCase().includes(q) ||
        l.resource_units?.serial_number?.toLowerCase().includes(q)
    );
  }, [myLoans, searchQuery]);

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

  const loading = loadingRequests || loadingLoans || loadingConsumables || loadingResources;
  const summaryCount = filteredRequests.length + filteredLoans.length + filteredConsumables.length + filteredAssignedResources.length;
  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderListShell = (
    key: string,
    title: string,
    count: number,
    icon: ReactNode,
    children: ReactNode
  ) => (
    <div key={key} className="overflow-hidden rounded-xl border border-black/[0.06] bg-white dark:border-white/[0.05] dark:bg-[#242424]">
      <button
        type="button"
        onClick={() => toggleSection(key)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-b border-black/[0.04] px-4 py-2.5 text-left transition-colors hover:bg-black/[0.015] dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: SECTION_ACCENT[key] ?? '#9CA3AF' }}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">{title}</span>
        <span className="rounded-[5px] bg-black/[0.05] px-1.5 py-0.5 text-xs text-gray-500 dark:bg-white/[0.07] dark:text-[#787774]">{count}</span>
        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 text-gray-400 transition-transform dark:text-[#555]', !collapsedSections[key] && 'rotate-180')} />
      </button>
      {!collapsedSections[key] && <div>{children}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-[30px] bg-transparent">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">A mi disposición</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-[#787774]">
              Revisa tus solicitudes, recursos en uso, consumibles retirados y asignaciones fijas desde un solo lugar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.03] px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-[#C8C8C6]">
              <Package className="h-4 w-4" />
              {summaryCount} registros visibles
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] p-1 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn('rounded-full px-3 py-2 text-sm transition-colors', viewMode === 'board' ? 'bg-white text-gray-900 dark:bg-[#242424] dark:text-[#E8E8E6]' : 'text-gray-500 dark:text-[#787774]')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn('rounded-full px-3 py-2 text-sm transition-colors', viewMode === 'list' ? 'bg-white text-gray-900 dark:bg-[#242424] dark:text-[#E8E8E6]' : 'text-gray-500 dark:text-[#787774]')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button variant="primary" className="bg-black text-white hover:bg-gray-800 shrink-0" onClick={() => router.push('/solicitar')}>
              <PlusCircle className="mr-2 h-4 w-4" /> Solicitar recurso
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
            <Input
              placeholder="Buscar por recurso, serie, motivo o ubicación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-[#787774]">
            <span className="rounded-full bg-black/[0.03] px-3 py-1.5 dark:bg-white/[0.04]">Solicitudes {filteredRequests.length}</span>
            <span className="rounded-full bg-black/[0.03] px-3 py-1.5 dark:bg-white/[0.04]">En uso {filteredLoans.length}</span>
            <span className="rounded-full bg-black/[0.03] px-3 py-1.5 dark:bg-white/[0.04]">Consumibles {filteredConsumables.length}</span>
            <span className="rounded-full bg-black/[0.03] px-3 py-1.5 dark:bg-white/[0.04]">Asignados {filteredAssignedResources.length}</span>
          </div>
        </div>
      </section>

      {!loading && summaryCount === 0 && !searchQuery ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
            <UserCircle className="w-6 h-6 text-gray-400 dark:text-[#555]" />
          </div>
          <p className="font-medium text-gray-900 dark:text-[#E8E8E6] text-sm">No tienes recursos asignados</p>
          <p className="text-xs text-gray-400 dark:text-[#555]">Los recursos que te sean asignados aparecerán aquí.</p>
        </div>
      ) : viewMode === 'board' ? (
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-4">
        <section className={cn('h-fit self-start rounded-[28px] p-3 shadow-sm dark:ring-1 dark:ring-white/[0.03]', COLUMN_STYLES.requests.shell)}>
          <button type="button" onClick={() => toggleSection('requests')} className="mb-3 flex w-full items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-700 dark:text-[#E8E8E6]" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Mis solicitudes</h2>
            <Badge className={COLUMN_STYLES.requests.badge}>{myRequests.length}</Badge>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform dark:text-[#787774]', !collapsedSections.requests && 'rotate-180')} />
          </button>
          {!collapsedSections.requests && (
          <div className="space-y-3">
            {loading ? (
              <EmptyColumn text="Cargando solicitudes..." />
            ) : filteredRequests.length === 0 ? (
              <EmptyColumn text="No tienes solicitudes por ahora." />
            ) : (
              filteredRequests.map((req) => (
                <Card
                  key={req.id}
                  className={cn('cursor-pointer p-4 shadow-none transition-colors', COLUMN_STYLES.requests.card)}
                  onClick={() => router.push('/solicitudes')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{req.resources?.name ?? 'Recurso'}</h3>
                      <p className="mt-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                        {req.quantity > 1 ? `Cantidad ${req.quantity} · ` : ''}
                        {new Date(req.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {req.status === 'pending' && <Badge variant="warning">Pendiente</Badge>}
                      {req.status === 'approved' && <Badge variant="success">Aprobado</Badge>}
                      {req.status === 'rejected' && <Badge variant="error">Rechazado</Badge>}
                    </div>
                  </div>
                  {(req.resources?.locations?.name || req.notes) && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-600 dark:text-[#AAAAAA]">
                        Horario: {formatTimeRange(req.start_time, req.end_time)}
                      </p>
                      {req.resources?.locations?.name && (
                        <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                          <MapPin className="h-3 w-3" /> Devolver en: {req.resources.locations.name}
                        </p>
                      )}
                      {req.notes && <p className="line-clamp-2 text-xs text-gray-600 dark:text-[#AAAAAA]">{req.notes}</p>}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
          )}
        </section>

        <section className={cn('h-fit self-start rounded-[28px] p-3 shadow-sm dark:ring-1 dark:ring-white/[0.03]', COLUMN_STYLES.loans.shell)}>
          <button type="button" onClick={() => toggleSection('loans')} className="mb-3 flex w-full items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-gray-700 dark:text-[#E8E8E6]" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Recursos en uso</h2>
            <Badge className={COLUMN_STYLES.loans.badge}>{myLoans.length}</Badge>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform dark:text-[#787774]', !collapsedSections.loans && 'rotate-180')} />
          </button>
          {!collapsedSections.loans && (
          <div className="space-y-3">
            {loading ? (
              <EmptyColumn text="Cargando préstamos..." />
            ) : filteredLoans.length === 0 ? (
              <EmptyColumn text="No tienes recursos en uso." />
            ) : (
              filteredLoans.map((loan) => {
                const isOverdue = loan.status === 'overdue';
                const dueToday = loan.due_date === new Date().toISOString().split('T')[0];
                return (
                  <Card
                    key={loan.id}
                    className={cn('cursor-pointer p-4 shadow-none transition-colors', COLUMN_STYLES.loans.card)}
                    onClick={() => router.push('/solicitudes')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{loan.resource_units?.resources?.name ?? 'Recurso'}</h3>
                        <p className="mt-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                          {loan.resource_units?.serial_number ? `${loan.resource_units.serial_number} · ` : ''}
                          Vence {new Date(loan.due_date).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {isOverdue && <Badge variant="error">Vencido</Badge>}
                        {dueToday && !isOverdue && <Badge variant="warning">Vence hoy</Badge>}
                        {loan.status === 'active' && !dueToday && <Badge variant="success">En uso</Badge>}
                      </div>
                    </div>
                    {loan.resource_units?.resources?.locations?.name && (
                      <p className="mt-3 flex items-center gap-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                        <MapPin className="h-3 w-3" /> Devolver en: {loan.resource_units.resources.locations.name}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-600 dark:text-[#AAAAAA]">
                      Hora prevista: {formatTimeRange(undefined, loan.requests?.end_time)}
                    </p>
                  </Card>
                );
              })
            )}
          </div>
          )}
        </section>

        <section className={cn('h-fit self-start rounded-[28px] p-3 shadow-sm dark:ring-1 dark:ring-white/[0.03]', COLUMN_STYLES.consumables.shell)}>
          <button type="button" onClick={() => toggleSection('consumables')} className="mb-3 flex w-full items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-gray-700 dark:text-[#E8E8E6]" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Retiros consumibles</h2>
            <Badge className={COLUMN_STYLES.consumables.badge}>{consumableActivity.length}</Badge>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform dark:text-[#787774]', !collapsedSections.consumables && 'rotate-180')} />
          </button>
          {!collapsedSections.consumables && (
          <div className="space-y-3">
            {loading ? (
              <EmptyColumn text="Cargando retiros..." />
            ) : filteredConsumables.length === 0 ? (
              <EmptyColumn text="Aún no has retirado consumibles." />
            ) : (
              filteredConsumables.map((entry) => (
                <Card
                  key={entry.id}
                  className={cn('cursor-pointer p-4 shadow-none transition-colors', COLUMN_STYLES.consumables.card)}
                  onClick={() => router.push(`/recursos/${entry.entity_id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{entry.details?.resource_name ?? 'Consumible'}</h3>
                      <p className="mt-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                        Cantidad {entry.details?.quantity ?? 0} · {new Date(entry.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <Badge variant="info">Retirado</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {entry.details?.use_location && (
                      <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                        <MapPin className="h-3 w-3" /> {entry.details.use_location}
                      </p>
                    )}
                    {entry.details?.notes && <p className="line-clamp-2 text-xs text-gray-600 dark:text-[#AAAAAA]">{entry.details.notes}</p>}
                  </div>
                </Card>
              ))
            )}
          </div>
          )}
        </section>

        <section className={cn('h-fit self-start rounded-[28px] p-3 shadow-sm dark:ring-1 dark:ring-white/[0.03]', COLUMN_STYLES.assigned.shell)}>
          <button type="button" onClick={() => toggleSection('assigned')} className="mb-3 flex w-full items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gray-700 dark:text-[#E8E8E6]" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Mis recursos asignados</h2>
            <Badge className={COLUMN_STYLES.assigned.badge}>{assignedResources.length}</Badge>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform dark:text-[#787774]', !collapsedSections.assigned && 'rotate-180')} />
          </button>
          {!collapsedSections.assigned && (
          <div className="space-y-3">
            {loading ? (
              <EmptyColumn text="Cargando asignaciones..." />
            ) : filteredAssignedResources.length === 0 ? (
              <EmptyColumn text="No tienes recursos fijos asignados." />
            ) : (
              filteredAssignedResources.map((resource) => (
                <Card
                  key={resource.id}
                  className={cn('cursor-pointer p-4 shadow-none transition-colors', COLUMN_STYLES.assigned.card)}
                  onClick={() => router.push(`/recursos/${resource.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.name}</h3>
                      <p className="mt-1 text-xs text-gray-600 dark:text-[#AAAAAA]">{resource.sku}</p>
                    </div>
                    <Badge variant="warm" className="border-transparent bg-white/70 text-gray-700 dark:bg-white/10 dark:text-[#F7C978]">
                      {getCatalogVisibility(resource) === 'internal' ? 'Fijo' : 'Area'}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {resource.locations?.name && (
                      <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#AAAAAA]">
                        <MapPin className="h-3 w-3" /> {resource.locations.name}
                      </p>
                    )}
                    {resource.owner_name && <p className="text-xs text-gray-600 dark:text-[#AAAAAA]">Asignado a: {resource.owner_name}</p>}
                  </div>
                </Card>
              ))
            )}
          </div>
          )}
        </section>
      </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mis solicitudes ── */}
          {renderListShell(
            'requests',
            'Mis solicitudes',
            filteredRequests.length,
            <ClipboardList className="h-4 w-4" />,
            loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">Cargando solicitudes…</p>
            ) : filteredRequests.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">No tienes solicitudes por ahora.</p>
            ) : (
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_150px_96px] border-b border-black/[0.04] dark:border-white/[0.04]">
                  {[
                    { icon: <ClipboardList className="h-3 w-3" />, label: 'Solicitud' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'Fecha' },
                    { icon: <Clock className="h-3 w-3" />, label: 'Horario' },
                    { icon: <Tag className="h-3 w-3" />, label: 'Estado' },
                  ].map((col) => (
                    <div key={col.label} className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-[#555]">
                      {col.icon}{col.label}
                    </div>
                  ))}
                </div>
                {filteredRequests.map((req) => {
                  const s = req.status === 'approved'
                    ? { dot: 'bg-emerald-500', label: 'Aprobado', tx: 'text-emerald-700 dark:text-emerald-400' }
                    : req.status === 'rejected'
                    ? { dot: 'bg-red-500', label: 'Rechazado', tx: 'text-red-600 dark:text-red-400' }
                    : { dot: 'bg-amber-400', label: 'Pendiente', tx: 'text-amber-700 dark:text-amber-400' };
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => router.push('/solicitudes')}
                      className="grid w-full cursor-pointer grid-cols-[1fr_100px_150px_96px] items-center border-b border-black/[0.03] text-left transition-colors last:border-0 hover:bg-[#F7F7F6] dark:border-white/[0.03] dark:hover:bg-white/[0.025]"
                    >
                      <div className="min-w-0 px-4 py-2.5">
                        <p className="truncate text-sm text-gray-900 dark:text-[#E8E8E6]">{req.resources?.name ?? 'Recurso'}</p>
                        {req.resources?.locations?.name && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400 dark:text-[#555]">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />{req.resources.locations.name}
                          </p>
                        )}
                      </div>
                      <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {new Date(req.created_at).toLocaleDateString('es-ES')}
                      </p>
                      <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {formatTimeRange(req.start_time, req.end_time)}
                      </p>
                      <div className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs', s.tx)}>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                          {s.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Recursos en uso ── */}
          {renderListShell(
            'loans',
            'Recursos en uso',
            filteredLoans.length,
            <ArrowLeftRight className="h-4 w-4" />,
            loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">Cargando préstamos…</p>
            ) : filteredLoans.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">No tienes recursos en uso.</p>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_110px_150px_96px] border-b border-black/[0.04] dark:border-white/[0.04]">
                  {[
                    { icon: <Package className="h-3 w-3" />, label: 'Recurso' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'Vence' },
                    { icon: <MapPin className="h-3 w-3" />, label: 'Devolución' },
                    { icon: <Tag className="h-3 w-3" />, label: 'Estado' },
                  ].map((col) => (
                    <div key={col.label} className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-[#555]">
                      {col.icon}{col.label}
                    </div>
                  ))}
                </div>
                {filteredLoans.map((loan) => {
                  const isOverdue = loan.status === 'overdue';
                  const dueToday = loan.due_date === new Date().toISOString().split('T')[0];
                  const s = isOverdue
                    ? { dot: 'bg-red-500', label: 'Vencido', tx: 'text-red-600 dark:text-red-400' }
                    : dueToday
                    ? { dot: 'bg-amber-400', label: 'Vence hoy', tx: 'text-amber-700 dark:text-amber-400' }
                    : { dot: 'bg-blue-500', label: 'En uso', tx: 'text-blue-700 dark:text-blue-400' };
                  return (
                    <button
                      key={loan.id}
                      type="button"
                      onClick={() => router.push('/solicitudes')}
                      className="grid w-full cursor-pointer grid-cols-[1fr_110px_150px_96px] items-center border-b border-black/[0.03] text-left transition-colors last:border-0 hover:bg-[#F7F7F6] dark:border-white/[0.03] dark:hover:bg-white/[0.025]"
                    >
                      <div className="min-w-0 px-4 py-2.5">
                        <p className="truncate text-sm text-gray-900 dark:text-[#E8E8E6]">{loan.resource_units?.resources?.name ?? 'Recurso'}</p>
                        {loan.resource_units?.serial_number && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400 dark:text-[#555]">
                            <Hash className="h-2.5 w-2.5 shrink-0" />{loan.resource_units.serial_number}
                          </p>
                        )}
                      </div>
                      <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {new Date(loan.due_date).toLocaleDateString('es-ES')}
                      </p>
                      <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                        {loan.resource_units?.resources?.locations?.name ?? '—'}
                      </p>
                      <div className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs', s.tx)}>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
                          {s.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Retiros consumibles ── */}
          {renderListShell(
            'consumables',
            'Retiros consumibles',
            filteredConsumables.length,
            <ShoppingBag className="h-4 w-4" />,
            loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">Cargando retiros…</p>
            ) : filteredConsumables.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">Aún no has retirado consumibles.</p>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_160px_72px_110px] border-b border-black/[0.04] dark:border-white/[0.04]">
                  {[
                    { icon: <ShoppingBag className="h-3 w-3" />, label: 'Consumible' },
                    { icon: <MapPin className="h-3 w-3" />, label: 'Ubicación' },
                    { icon: <Hash className="h-3 w-3" />, label: 'Cant.' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'Fecha' },
                  ].map((col) => (
                    <div key={col.label} className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-[#555]">
                      {col.icon}{col.label}
                    </div>
                  ))}
                </div>
                {filteredConsumables.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => router.push(`/recursos/${entry.entity_id}`)}
                    className="grid w-full cursor-pointer grid-cols-[1fr_160px_72px_110px] items-center border-b border-black/[0.03] text-left transition-colors last:border-0 hover:bg-[#F7F7F6] dark:border-white/[0.03] dark:hover:bg-white/[0.025]"
                  >
                    <div className="min-w-0 px-4 py-2.5">
                      <p className="truncate text-sm text-gray-900 dark:text-[#E8E8E6]">{entry.details?.resource_name ?? 'Consumible'}</p>
                      {entry.details?.notes && (
                        <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-[#555]">{entry.details.notes}</p>
                      )}
                    </div>
                    <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                      {entry.details?.use_location ?? '—'}
                    </p>
                    <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                      {entry.details?.quantity ?? 0}
                    </p>
                    <div className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-400">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                        {new Date(entry.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* ── Recursos asignados ── */}
          {renderListShell(
            'assigned',
            'Mis recursos asignados',
            filteredAssignedResources.length,
            <ShieldCheck className="h-4 w-4" />,
            loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">Cargando asignaciones…</p>
            ) : filteredAssignedResources.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#555]">No tienes recursos fijos asignados.</p>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_110px_160px_84px] border-b border-black/[0.04] dark:border-white/[0.04]">
                  {[
                    { icon: <Package className="h-3 w-3" />, label: 'Asignación' },
                    { icon: <Hash className="h-3 w-3" />, label: 'SKU' },
                    { icon: <MapPin className="h-3 w-3" />, label: 'Ubicación' },
                    { icon: <Tag className="h-3 w-3" />, label: 'Tipo' },
                  ].map((col) => (
                    <div key={col.label} className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-[#555]">
                      {col.icon}{col.label}
                    </div>
                  ))}
                </div>
                {filteredAssignedResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => router.push(`/recursos/${resource.id}`)}
                    className="grid w-full cursor-pointer grid-cols-[1fr_110px_160px_84px] items-center border-b border-black/[0.03] text-left transition-colors last:border-0 hover:bg-[#F7F7F6] dark:border-white/[0.03] dark:hover:bg-white/[0.025]"
                  >
                    <div className="min-w-0 px-4 py-2.5">
                      <p className="truncate text-sm text-gray-900 dark:text-[#E8E8E6]">{resource.name}</p>
                    </div>
                    <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">{resource.sku ?? '—'}</p>
                    <p className="px-4 py-2.5 text-xs text-gray-500 dark:text-[#787774]">
                      {resource.locations?.name ?? '—'}
                    </p>
                    <div className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {getCatalogVisibility(resource) === 'internal' ? 'Fijo' : 'Área'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
