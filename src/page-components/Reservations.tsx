'use client'
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useIsDepartmentLeader, useRequests } from '@/lib/hooks';
import { compareIsoDate, eventTouchesDay, formatTimeRange, toIsoDate } from '@/lib/scheduling';
import { cn } from '@/lib/utils';

type FilterStatus = 'todos' | 'approved' | 'pending' | 'rejected';
type FilterKind = 'todos' | 'hoy' | 'proximas';

const MONTH_LABEL = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function formatDisplayDate(value?: string | null) {
  const iso = toIsoDate(value);
  if (!iso) return 'Sin fecha';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function Reservations() {
  const router = useRouter();
  const { user } = useAuth();
  const { role } = useRole();
  const isDepartmentLeader = useIsDepartmentLeader(user?.id);
  const { requests, loading } = useRequests();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  const [filterKind, setFilterKind] = useState<FilterKind>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];
  const canAccessAll = role === 'admin' || role === 'approver' || isDepartmentLeader;

  const scheduledRequests = useMemo(() => {
    return requests
      .map((req: any) => {
        const startDate = toIsoDate(req.needed_from ?? req.start_date);
        const endDate = toIsoDate(req.needed_until ?? req.end_date ?? req.needed_from ?? req.start_date);
        if (!startDate || !endDate) return null;
        return {
          ...req,
          startDate,
          endDate,
        };
      })
      .filter(Boolean)
      .filter((req: any) => (canAccessAll ? true : req.user_id === user?.id))
      .sort((a: any, b: any) => compareIsoDate(a.startDate, b.startDate));
  }, [canAccessAll, requests, user?.id]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scheduledRequests.filter((req: any) => {
      const matchQuery =
        !q ||
        req.resources?.name?.toLowerCase().includes(q) ||
        req.profiles?.full_name?.toLowerCase().includes(q) ||
        req.resources?.locations?.name?.toLowerCase().includes(q);

      const matchStatus = filterStatus === 'todos' || req.status === filterStatus;

      const isToday = compareIsoDate(req.startDate, todayIso) <= 0 && compareIsoDate(req.endDate, todayIso) >= 0;
      const isUpcoming = compareIsoDate(req.startDate, todayIso) > 0;
      const matchesCalendar = !selectedCalendarDate || eventTouchesDay(selectedCalendarDate, req.startDate, req.endDate);
      const matchKind =
        filterKind === 'todos' ||
        (filterKind === 'hoy' && isToday) ||
        (filterKind === 'proximas' && isUpcoming);

      return matchQuery && matchStatus && matchKind && matchesCalendar;
    });
  }, [filterKind, filterStatus, scheduledRequests, searchQuery, selectedCalendarDate, todayIso]);

  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((req: any) => {
      let markerDate = new Date(`${req.startDate}T00:00:00`);
      const endDate = new Date(`${req.endDate}T00:00:00`);
      while (markerDate <= endDate) {
        if (
          markerDate.getFullYear() === calendarMonth.getFullYear() &&
          markerDate.getMonth() === calendarMonth.getMonth()
        ) {
          const iso = markerDate.toISOString().split('T')[0];
          map.set(iso, (map.get(iso) || 0) + 1);
        }
        markerDate.setDate(markerDate.getDate() + 1);
      }
    });
    return map;
  }, [calendarMonth, filtered]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells: Array<{ iso: string | null; label: string; count: number; isToday: boolean; isSelected: boolean }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ iso: null, label: '', count: 0, isToday: false, isSelected: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const iso = date.toISOString().split('T')[0];
      cells.push({
        iso,
        label: String(day),
        count: eventCountByDay.get(iso) || 0,
        isToday: iso === todayIso,
        isSelected: iso === selectedCalendarDate,
      });
    }

    return cells;
  }, [calendarMonth, eventCountByDay, selectedCalendarDate, todayIso]);

  const hasActiveFilters = filterStatus !== 'todos' || filterKind !== 'todos' || searchQuery.trim().length > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Reservas Programadas</h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">
            Visualiza solicitudes con fecha de uso programada y consulta la agenda operativa del sistema.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={() => setModalOpen(true)}>
            <CalendarIcon className="w-4 h-4 mr-2" /> Nueva Reserva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="max-w-md">
              <Input
                placeholder="Buscar por recurso, usuario o ubicación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-[#787774] font-medium">Estado:</span>
              {(['todos', 'approved', 'pending', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    filterStatus === status
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                  )}
                >
                  {status === 'todos' ? 'Todos' : status === 'approved' ? 'Aprobadas' : status === 'pending' ? 'Pendientes' : 'Rechazadas'}
                </button>
              ))}

              <span className="text-xs text-gray-500 dark:text-[#787774] font-medium ml-2">Momento:</span>
              {(['todos', 'hoy', 'proximas'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setFilterKind(kind)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    filterKind === kind
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                  )}
                >
                  {kind === 'todos' ? 'Todos' : kind === 'hoy' ? 'Hoy' : 'Próximas'}
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('todos');
                    setFilterKind('todos');
                    setSelectedCalendarDate(null);
                  }}
                  className="text-xs font-medium text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-[#787774]">Cargando agenda...</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-[#787774] text-sm">
                No hay reservas programadas que coincidan con los filtros.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                {filtered.map((req: any) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => router.push('/solicitudes')}
                    className="w-full px-6 py-4 text-left hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] truncate">
                            {req.resources?.name || 'Solicitud'}
                          </p>
                          <Badge
                            variant={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'pending'
                                  ? 'warning'
                                  : 'error'
                            }
                          >
                            {req.status === 'approved' ? 'Aprobada' : req.status === 'pending' ? 'Pendiente' : 'Rechazada'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-[#787774]">
                          <span>{req.profiles?.full_name || 'Usuario'}</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {formatDisplayDate(req.startDate)}
                            {req.endDate !== req.startDate ? ` - ${formatDisplayDate(req.endDate)}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimeRange(req.start_time, req.end_time)}
                          </span>
                          {req.resources?.locations?.name && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {req.resources.locations.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#555] shrink-0">
                        {req.quantity || 1} unidad(es)
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Calendario</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                {MONTH_LABEL.format(calendarMonth)}
              </h2>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-[#787774] dark:hover:bg-[#1D1D1D]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-[#787774] dark:hover:bg-[#1D1D1D]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-medium text-gray-400 dark:text-[#555]">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, index) => (
              <button
                type="button"
                key={`${cell.iso ?? 'blank'}-${index}`}
                disabled={!cell.iso}
                onClick={() => setSelectedCalendarDate((prev) => (prev === cell.iso ? null : cell.iso))}
                className={cn(
                  'aspect-square rounded-2xl flex flex-col items-center justify-center text-sm transition-colors',
                  !cell.iso && 'opacity-0',
                  cell.iso && 'bg-gray-50 hover:bg-gray-100 dark:bg-[#1D1D1D] dark:hover:bg-[#252525]',
                  cell.isSelected && 'ring-2 ring-[#3159B8]/45 dark:ring-[#A7C0FF]/40',
                  cell.isToday && 'bg-gray-900 text-white dark:bg-[#E8E8E6] dark:text-[#191919]'
                )}
              >
                <span>{cell.label}</span>
                {cell.count > 0 && (
                  <span
                    className={cn(
                      'mt-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      cell.isToday
                        ? 'bg-white/15 text-white dark:bg-[#191919]/10 dark:text-[#191919]'
                        : 'bg-[#EEF4FF] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]'
                    )}
                  >
                    {cell.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[18px] bg-gray-50 dark:bg-[#1D1D1D] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-[#787774]">
                  {selectedCalendarDate ? `Solicitudes en ${formatDisplayDate(selectedCalendarDate)}` : 'Solicitudes programadas este mes'}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">
                  {selectedCalendarDate
                    ? filtered.length
                    : Array.from(eventCountByDay.values()).reduce((sum, count) => sum + count, 0)}
                </p>
              </div>
              {selectedCalendarDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCalendarDate(null)}>
                  Ver mes completo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Nueva Reserva</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#AAAAAA] hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-[#AAAAAA]">
                Puedes reservar <strong>recursos</strong> creando una solicitud con fecha de uso, o gestionar <strong>espacios</strong> desde ubicaciones.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="w-full bg-black text-white"
                  onClick={() => {
                    setModalOpen(false);
                    router.push('/solicitar');
                  }}
                >
                  <Package className="w-4 h-4 mr-2" /> Crear solicitud programada
                </Button>
                <Button
                  variant="secondary"
                  className="w-full bg-white dark:bg-[#242424]"
                  onClick={() => {
                    setModalOpen(false);
                    router.push('/ubicaciones');
                  }}
                >
                  <Building2 className="w-4 h-4 mr-2" /> Ver espacios reservables
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
