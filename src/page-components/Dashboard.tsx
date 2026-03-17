'use client'
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  FileText,
  Package,
  Plus,
  ScanLine,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogs, useIsDepartmentLeader, useLoans, useManagedScopes, useRequests, useResources } from '@/lib/hooks';
import { allocateAndCreateLoans as doAllocateLoans } from '@/lib/loanAllocation';
import { compareIsoDate, eventTouchesDay, formatAgendaTimeLabel, toIsoDate } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (target === prev.current) return;
    prev.current = target;
    if (target === 0) {
      setCount(0);
      return;
    }
    const from = count;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setCount(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, count, duration]);

  return count;
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const up: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

const MONTH_LABEL = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const LONG_DATE_LABEL = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const DAY_LABEL = new Intl.DateTimeFormat('es-ES', { day: '2-digit' });
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function formatAgendaDate(value?: string | null) {
  const iso = toIsoDate(value);
  if (!iso) return 'Sin fecha';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export function Dashboard() {
  const router = useRouter();
  const { role } = useRole();
  const { user } = useAuth();
  const { resources, loading: loadingResources } = useResources();
  const { loans, loading: loadingLoans, refetchLoans } = useLoans();
  const { requests: allRequests, loading: loadingRequests, refetchRequests } = useRequests();
  const { logs: activityLogs } = useActivityLogs(12);
  const isDepartmentLeader = useIsDepartmentLeader(user?.id);
  const { managedDepartmentIds, managedLocationIds } = useManagedScopes(user?.id);

  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayIso);

  const canApproveRequest = (req: any) => {
    if (role === 'admin') return true;
    const leaderId = req?.resources?.departments?.leader_id;
    const deptId = req?.resources?.department_id;
    const locationId = req?.resources?.location_id;
    if (deptId && leaderId) return user?.id === leaderId;
    if (deptId && managedDepartmentIds.includes(deptId)) return true;
    if (locationId && managedLocationIds.includes(locationId)) return true;
    if (!deptId && role === 'approver') return true;
    return false;
  };

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);
  const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(null);
  const [itemMessage, setItemMessage] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  const rawResources = loadingResources ? 0 : resources.length;
  const rawActive = loadingLoans ? 0 : loans.filter((l: any) => l.status === 'active' || l.status === 'overdue').length;
  const rawOverdue = loadingLoans ? 0 : loans.filter((l: any) => l.status === 'overdue').length;
  const rawPending = loadingRequests ? 0 : allRequests.filter((r: any) => r.status === 'pending').length;

  const totalResources = useCountUp(rawResources);
  const activeLoans = useCountUp(rawActive);
  const overdueLoans = useCountUp(rawOverdue);
  const pendingCount = useCountUp(rawPending);

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    const base = { status, processed_by: user?.id };
    try {
      const { error } = await supabase.from('requests').update({ ...base, processed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('processed_at') || msg.includes('column') || msg.includes('schema')) {
        const { error } = await supabase.from('requests').update(base).eq('id', id);
        if (error) throw error;
      } else {
        throw err;
      }
    }
  };

  const handleApprove = async (id: string) => {
    const req = allRequests.find((r: any) => r.id === id);
    if (!req || !canApproveRequest(req)) return;
    setProcessingId(id);
    setProcessingAction('approve');
    try {
      await updateRequestStatus(id, 'approved');
      await doAllocateLoans(supabase, req, user!.id);
      try {
        const label = req?.resources?.name ? (req.quantity > 1 ? `${req.resources.name} (x${req.quantity})` : req.resources.name) : 'recurso';
        await supabase.from('activity_logs').insert({
          action: 'request_approved',
          entity_type: 'request',
          entity_id: id,
          user_id: user?.id,
          details: {
            message: `Solicitud de ${label} aprobada`,
            actor_name: user?.user_metadata?.full_name,
          },
        });
      } catch (_) {}
      setItemMessage((prev) => ({ ...prev, [id]: { type: 'success', text: 'Aprobada correctamente' } }));
      refetchRequests?.();
      refetchLoans?.();
    } catch (err: any) {
      setItemMessage((prev) => ({ ...prev, [id]: { type: 'error', text: err?.message || 'No se pudo aprobar' } }));
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleReject = async (id: string) => {
    const req = allRequests.find((r: any) => r.id === id);
    if (!req || !canApproveRequest(req)) return;
    setProcessingId(id);
    setProcessingAction('reject');
    setConfirmingRejectId(null);
    try {
      await updateRequestStatus(id, 'rejected');
      try {
        const label = req?.resources?.name || 'recurso';
        await supabase.from('activity_logs').insert({
          action: 'request_rejected',
          entity_type: 'request',
          entity_id: id,
          user_id: user?.id,
          details: {
            message: `Solicitud de ${label} rechazada`,
            actor_name: user?.user_metadata?.full_name,
          },
        });
      } catch (_) {}
      setItemMessage((prev) => ({ ...prev, [id]: { type: 'success', text: 'Rechazada' } }));
      refetchRequests?.();
    } catch (err: any) {
      setItemMessage((prev) => ({ ...prev, [id]: { type: 'error', text: err?.message || 'No se pudo rechazar' } }));
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const canAccessGestion = role === 'admin' || role === 'approver' || isDepartmentLeader;
  const approvalQueue = allRequests.filter((r: any) => r.status === 'pending').filter((r: any) => canApproveRequest(r)).slice(0, 4);
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario';

  const scheduledRequests = useMemo(() => {
    return allRequests
      .map((req: any) => {
        const startDate = toIsoDate(req.needed_from ?? req.start_date ?? req.created_at);
        const endDate = toIsoDate(req.needed_until ?? req.end_date ?? req.needed_from ?? req.start_date ?? req.created_at);
        if (!startDate || !endDate) return null;
        return {
          ...req,
          startDate,
          endDate,
        };
      })
      .filter(Boolean) as Array<any>;
  }, [allRequests]);

  const myUpcomingRequests = useMemo(() => {
    return scheduledRequests
      .filter((req) => req.user_id === user?.id && compareIsoDate(req.endDate, todayIso) >= 0)
      .sort((a, b) => compareIsoDate(a.startDate, b.startDate))
      .slice(0, 4);
  }, [scheduledRequests, todayIso, user?.id]);

  const dueToday = useMemo(() => {
    return loans
      .filter((loan: any) => loan.due_date === todayIso)
      .slice(0, 4);
  }, [loans, todayIso]);

  const agendaItems = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      title: string;
      subtitle: string;
      timeLabel: string;
      tone: 'blue' | 'amber' | 'green' | 'rose';
      kindLabel: string;
      route: string;
    }> = [];

    scheduledRequests.forEach((req: any) => {
      if (eventTouchesDay(selectedCalendarDate, req.startDate, req.endDate)) {
        items.push({
          id: req.id,
          date: req.startDate,
          title: req.resources?.name || 'Solicitud programada',
          subtitle: req.status === 'pending' ? 'Pendiente de aprobación' : req.status === 'approved' ? 'Programada para hoy' : 'Solicitud activa hoy',
          timeLabel: formatAgendaTimeLabel(req.start_time, req.end_time),
          tone: req.status === 'pending' ? 'amber' : 'blue',
          kindLabel: 'Solicitud',
          route: '/solicitudes',
        });
      }
    });

    dueToday.forEach((loan: any) => {
      if (loan.due_date === selectedCalendarDate) {
        items.push({
          id: loan.id,
          date: loan.due_date,
          title: loan.resource_units?.resources?.name || 'Préstamo',
          subtitle: loan.profiles?.full_name ? `Vence hoy para ${loan.profiles.full_name}` : 'Vence hoy',
          timeLabel: 'Devolver hoy',
          tone: loan.status === 'overdue' ? 'rose' : 'green',
          kindLabel: 'Vencimiento',
          route: '/prestamos?status=due_today',
        });
      }
    });

    return items
      .sort((a, b) => compareIsoDate(a.date, b.date))
      .slice(0, 6);
  }, [dueToday, scheduledRequests, selectedCalendarDate]);

  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    scheduledRequests.forEach((req: any) => {
      let markerDate = new Date(`${req.startDate}T00:00:00`);
      const end = new Date(`${req.endDate}T00:00:00`);
      while (markerDate <= end) {
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
    loans.forEach((loan: any) => {
      const date = toIsoDate(loan.due_date);
      if (!date) return;
      const markerDate = new Date(`${date}T00:00:00`);
      if (
        markerDate.getFullYear() === calendarMonth.getFullYear() &&
        markerDate.getMonth() === calendarMonth.getMonth()
      ) {
        map.set(date, (map.get(date) || 0) + 1);
      }
    });
    return map;
  }, [calendarMonth, loans, scheduledRequests]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells: Array<{ iso: string | null; label: string; isToday: boolean; isSelected: boolean; count: number }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ iso: null, label: '', isToday: false, isSelected: false, count: 0 });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const iso = date.toISOString().split('T')[0];
      cells.push({
        iso,
        label: String(day),
        isToday: iso === todayIso,
        isSelected: iso === selectedCalendarDate,
        count: eventCountByDay.get(iso) || 0,
      });
    }

    return cells;
  }, [calendarMonth, eventCountByDay, selectedCalendarDate, todayIso]);

  const lowStockItems = useMemo(() => {
    return resources
      .filter((r: any) => (r.available_quantity ?? r.initial_quantity ?? 0) <= (r.notification_threshold || 0))
      .slice(0, 4);
  }, [resources]);

  const dashboardTone = {
    blue: 'bg-[#EEF4FF] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]',
    amber: 'bg-[#FEF4E8] text-[#B26B1B] dark:bg-[#3A2B1D] dark:text-[#F5C78F]',
    green: 'bg-[#ECF8F1] text-[#257A4D] dark:bg-[#1B3325] dark:text-[#9ED8B4]',
    rose: 'bg-[#FCEFF2] text-[#B34D6D] dark:bg-[#3B222B] dark:text-[#F0A8BE]',
  } as const;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"
      >
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/60 dark:bg-emerald-900/20 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            Panel operativo
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">
              Hola, {firstName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#787774] mt-1 capitalize">
              {LONG_DATE_LABEL.format(today)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="bg-white dark:bg-[#242424] text-gray-700 dark:text-[#C8C8C6]"
            onClick={() => router.push('/reservas')}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Ver reservas
          </Button>
          <Button
            variant="secondary"
            className="bg-[#EEF4FF] text-[#3159B8] hover:bg-[#E5EEFF] dark:bg-[#1E2A40] dark:text-[#A7C0FF] dark:hover:bg-[#253450] border-0"
            onClick={() => router.push('/escanear')}
          >
            <ScanLine className="w-4 h-4 mr-2" />
            Escanear
          </Button>
          {role === 'admin' && (
            <Button
              variant="primary"
              className="bg-gray-900 text-white hover:bg-black dark:bg-[#E8E8E6] dark:text-[#191919]"
              onClick={() => router.push('/recursos/nuevo')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo recurso
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 items-start">
        <motion.div variants={up} initial="hidden" animate="show" className="xl:col-span-8 space-y-4">
          <Card className="p-4 md:p-5 bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'Recursos activos',
                  value: loadingResources ? '—' : totalResources,
                  note: `${resources.filter((r: any) => (r.available_quantity ?? 0) > 0).length} disponibles`,
                  tone: 'bg-[#F0F0EF] text-gray-600 dark:bg-[#1D1D1D] dark:text-[#C8C8C6]',
                  icon: Package,
                  route: '/recursos',
                },
                {
                  label: 'En préstamo',
                  value: loadingLoans ? '—' : activeLoans,
                  note: `${dueToday.length} vencen hoy`,
                  tone: 'bg-[#EEF4FF] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]',
                  icon: Clock3,
                  route: '/prestamos?status=active',
                },
                {
                  label: 'Pendientes',
                  value: loadingRequests ? '—' : pendingCount,
                  note: canAccessGestion ? `${approvalQueue.length} para revisar` : 'Tus solicitudes activas',
                  tone: 'bg-[#FEF4E8] text-[#B26B1B] dark:bg-[#3A2B1D] dark:text-[#F5C78F]',
                  icon: ClipboardList,
                  route: '/solicitudes',
                },
                {
                  label: 'Vencidos',
                  value: loadingLoans ? '—' : overdueLoans,
                  note: lowStockItems.length > 0 ? `${lowStockItems.length} alertas de stock` : 'Sin alertas críticas',
                  tone: 'bg-[#FCEFF2] text-[#B34D6D] dark:bg-[#3B222B] dark:text-[#F0A8BE]',
                  icon: AlertTriangle,
                  route: '/prestamos?status=overdue',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.route)}
                    className="group cursor-pointer rounded-[22px] bg-[#F8F8F7] dark:bg-[#262626] p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#2B2B2B]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl', item.tone)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-[#444] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-[#555]">
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#E8E8E6]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-[#787774]">{item.note}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">
                  {canAccessGestion ? 'Bandeja operativa' : 'Tus próximos pedidos'}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                  {canAccessGestion ? 'Solicitudes por revisar' : 'Solicitudes agendadas'}
                </h2>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-black/[0.04] dark:bg-[#292929] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-[#AAAAAA]">
                  {canAccessGestion ? `${approvalQueue.length} pendientes` : `${myUpcomingRequests.length} programadas`}
                </span>
                <Button variant="ghost" size="sm" onClick={() => router.push('/solicitudes')}>
                  Ver gestión
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              <AnimatePresence>
                {(canAccessGestion ? approvalQueue : myUpcomingRequests).length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <CheckCircle2 className="w-8 h-8 text-gray-300 dark:text-[#444] mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                      {canAccessGestion ? 'Nada pendiente por ahora' : 'No tienes pedidos agendados'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">
                      {canAccessGestion
                        ? 'Cuando lleguen nuevas solicitudes aparecerán aquí.'
                        : 'Tus solicitudes con fecha de uso aparecerán aquí.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                    {(canAccessGestion ? approvalQueue : myUpcomingRequests).map((req: any, index: number) => {
                      const message = itemMessage[req.id];
                      const isProcessing = processingId === req.id;
                      const isConfirming = confirmingRejectId === req.id;
                      const statusTone =
                        req.status === 'approved'
                          ? dashboardTone.blue
                          : req.status === 'pending'
                            ? dashboardTone.amber
                            : dashboardTone.green;

                      return (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="px-5 py-4"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] truncate">
                                  {req.resources?.name || 'Solicitud'}
                                </p>
                                <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium', statusTone)}>
                                  {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobada' : 'Programada'}
                                </span>
                                {req.urgency === 'high' && (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium bg-[#FCEFF2] text-[#B34D6D] dark:bg-[#3B222B] dark:text-[#F0A8BE]">
                                    Urgente
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                                {req.profiles?.full_name || 'Usuario'} · {req.quantity || 1} unidad(es)
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600 dark:text-[#AAAAAA]">
                                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {formatAgendaDate(req.needed_from ?? req.start_date ?? req.created_at)}
                                  {toIsoDate(req.needed_until ?? req.end_date) &&
                                  toIsoDate(req.needed_until ?? req.end_date) !== toIsoDate(req.needed_from ?? req.start_date ?? req.created_at)
                                    ? ` - ${formatAgendaDate(req.needed_until ?? req.end_date)}`
                                    : ''}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-[#292929] px-2.5 py-1 text-gray-500 dark:text-[#787774]">
                                  <Clock3 className="w-3 h-3" />
                                  {formatAgendaTimeLabel(req.start_time, req.end_time)}
                                </span>
                                {req.resources?.locations?.name && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-[#292929] px-2.5 py-1 text-gray-500 dark:text-[#787774]">
                                    <CircleDot className="w-3 h-3" />
                                    {req.resources.locations.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {canAccessGestion ? (
                              <div className="w-full lg:w-[260px]">
                                <AnimatePresence mode="wait">
                                  {message ? (
                                    <motion.div
                                      key="message"
                                      initial={{ opacity: 0, scale: 0.98 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      className={cn(
                                        'flex items-center gap-2 rounded-[18px] px-3 py-2.5 text-xs',
                                        message.type === 'success'
                                          ? 'bg-[#ECF8F1] text-[#257A4D] dark:bg-[#1B3325] dark:text-[#9ED8B4]'
                                          : 'bg-[#FCEFF2] text-[#B34D6D] dark:bg-[#3B222B] dark:text-[#F0A8BE]'
                                      )}
                                    >
                                      {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                      {message.text}
                                    </motion.div>
                                  ) : isConfirming ? (
                                    <motion.div
                                      key="confirm"
                                      initial={{ opacity: 0, scale: 0.98 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      className="rounded-[18px] bg-[#FCEFF2] px-3 py-3 dark:bg-[#3B222B]"
                                    >
                                      <p className="text-xs text-[#B34D6D] dark:text-[#F0A8BE] mb-2">
                                        ¿Rechazar esta solicitud?
                                      </p>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                        className="flex-1 bg-white text-[#B34D6D] dark:bg-[#2A2A2A] dark:text-[#F0A8BE]"
                                          onClick={() => handleReject(req.id)}
                                          disabled={isProcessing}
                                        >
                                          {isProcessing && processingAction === 'reject' ? 'Rechazando...' : 'Confirmar'}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setConfirmingRejectId(null)}>
                                          Cancelar
                                        </Button>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="actions"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="flex gap-2"
                                    >
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1 bg-[#EEF4FF] text-[#3159B8] hover:bg-[#E5EEFF] dark:bg-[#1E2A40] dark:text-[#A7C0FF] dark:hover:bg-[#253450] border-0"
                                        onClick={() => handleApprove(req.id)}
                                        disabled={isProcessing || !canApproveRequest(req)}
                                      >
                                        {isProcessing && processingAction === 'approve' ? 'Aprobando...' : 'Aprobar'}
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1 bg-transparent text-gray-700 hover:bg-black/[0.02] dark:bg-[#292929] dark:text-[#C8C8C6] dark:hover:bg-[#303030] border-0"
                                        onClick={() => setConfirmingRejectId(req.id)}
                                        disabled={isProcessing || !canApproveRequest(req)}
                                      >
                                        Rechazar
                                      </Button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ) : (
                              <div className="lg:w-[220px]">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="w-full bg-transparent dark:bg-[#292929] border-0"
                                  onClick={() => router.push('/solicitudes')}
                                >
                                  Ver detalle
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Actividad</p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Últimos movimientos</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push('/solicitudes')}>
                  Ver todo
                </Button>
              </div>
              <CardContent className="space-y-3">
                {activityLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-[#555] py-6 text-center">Sin actividad reciente</p>
                ) : (
                  activityLogs.slice(0, 5).map((log: any) => {
                    const isLoan = String(log.action || '').includes('loan');
                    const isRequest = String(log.action || '').includes('request');
                    const tone = isLoan ? dashboardTone.green : isRequest ? dashboardTone.blue : dashboardTone.amber;
                    return (
                      <div key={log.id} className="flex items-start gap-3 rounded-[18px] bg-[#F8F8F7] dark:bg-[#262626] px-3 py-3">
                        <span className={cn('mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full', tone)}>
                          <CircleDot className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-700 dark:text-[#C8C8C6] leading-relaxed">
                            <span className="font-semibold text-gray-900 dark:text-[#E8E8E6]">
                              {log?.details?.actor_name || 'Sistema'}
                            </span>{' '}
                            {log?.details?.message || `${log.action} · ${log.entity_type}`}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400 dark:text-[#555]">
                            {new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Atajos</p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Acciones rápidas</h2>
                </div>
              </div>
              <CardContent className="space-y-3">
                {[
                  {
                    label: 'Nueva solicitud',
                    desc: 'Crear un pedido o préstamo programado',
                    tone: 'bg-[#EEF4FF] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]',
                    icon: Plus,
                    route: '/solicitar',
                  },
                  {
                    label: 'Escanear recurso',
                    desc: 'Consultar o devolver con QR',
                    tone: 'bg-[#ECF8F1] text-[#257A4D] dark:bg-[#1B3325] dark:text-[#9ED8B4]',
                    icon: ScanLine,
                    route: '/escanear',
                  },
                  {
                    label: 'Abrir reportes',
                    desc: 'Ver métricas y comparativos',
                    tone: 'bg-[#FCEFF2] text-[#B34D6D] dark:bg-[#3B222B] dark:text-[#F0A8BE]',
                    icon: FileText,
                    route: '/reportes',
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => router.push(action.route)}
                      className="flex w-full items-center gap-3 rounded-[18px] bg-[#F8F8F7] dark:bg-[#262626] px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#2B2B2B]"
                    >
                      <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl', action.tone)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{action.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-[#787774]">{action.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <motion.div variants={up} initial="hidden" animate="show" className="xl:col-span-4 space-y-4">
          <Card className="p-4 md:p-5 bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">
                  {selectedCalendarDate === todayIso ? 'Hoy' : 'Agenda seleccionada'}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                  {selectedCalendarDate === todayIso ? 'Agenda del día' : formatAgendaDate(selectedCalendarDate)}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 dark:text-[#787774]"
                onClick={() => router.push('/reservas')}
              >
                Calendario
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {agendaItems.length === 0 ? (
                <div className="rounded-[20px] bg-[#F8F8F7] dark:bg-[#262626] px-4 py-8 text-center">
                  <CalendarDays className="w-8 h-8 text-gray-300 dark:text-[#444] mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                    {selectedCalendarDate === todayIso ? 'Sin eventos para hoy' : 'Sin eventos en esta fecha'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">
                    Las solicitudes programadas y vencimientos del día aparecerán aquí.
                  </p>
                </div>
              ) : (
                agendaItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(item.route)}
                    className="w-full rounded-[20px] bg-[#F8F8F7] dark:bg-[#262626] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#2B2B2B]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium', dashboardTone[item.tone])}>
                            {item.kindLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] truncate">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">{item.subtitle}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-gray-700 dark:text-[#C8C8C6]">{item.timeLabel}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Calendario</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">
                  {MONTH_LABEL.format(calendarMonth)}
                </h2>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  className="rounded-xl p-2 text-gray-500 hover:bg-black/[0.03] dark:text-[#787774] dark:hover:bg-[#2A2A2A]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  className="rounded-xl p-2 text-gray-500 hover:bg-black/[0.03] dark:text-[#787774] dark:hover:bg-[#2A2A2A]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium text-gray-400 dark:text-[#555]">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-1">{label}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, index) => (
                  <button
                    type="button"
                    key={`${cell.iso ?? 'blank'}-${index}`}
                    disabled={!cell.iso}
                    onClick={() => cell.iso && setSelectedCalendarDate(cell.iso)}
                    className={cn(
                      'aspect-square cursor-pointer rounded-2xl flex flex-col items-center justify-center text-sm transition-colors',
                      !cell.iso && 'opacity-0',
                      cell.iso && 'bg-[#F5F5F4] dark:bg-[#252525] hover:bg-white dark:hover:bg-[#2C2C2C]',
                      cell.isSelected && 'ring-2 ring-[#3159B8]/50 dark:ring-[#A7C0FF]/45',
                      cell.isToday && 'bg-gray-900 text-white dark:bg-[#E8E8E6] dark:text-[#191919]'
                    )}
                  >
                    <span className="leading-none">{cell.label}</span>
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

              <div className="mt-4 flex items-center justify-between rounded-[18px] bg-[#F8F8F7] dark:bg-[#262626] px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-[#787774]">
                    {selectedCalendarDate === todayIso ? 'Eventos detectados este mes' : `Eventos en ${formatAgendaDate(selectedCalendarDate)}`}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">
                    {selectedCalendarDate === todayIso
                      ? Array.from(eventCountByDay.values()).reduce((sum, count) => sum + count, 0)
                      : agendaItems.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedCalendarDate !== todayIso && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCalendarDate(todayIso)}>
                      Volver a hoy
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => router.push('/reservas')}>
                    Abrir reservas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#202020] shadow-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Monitoreo</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Alertas suaves</h2>
            </div>
            <CardContent className="space-y-3">
              {lowStockItems.length === 0 ? (
                <div className="rounded-[18px] bg-[#F8F8F7] dark:bg-[#262626] px-4 py-6 text-center">
                  <CheckCircle2 className="w-7 h-7 text-gray-300 dark:text-[#444] mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Inventario estable</p>
                  <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">No hay alertas críticas de stock ahora mismo.</p>
                </div>
              ) : (
                lowStockItems.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/recursos/${item.id}`)}
                    className="flex w-full items-center gap-3 rounded-[18px] bg-[#F8F8F7] dark:bg-[#262626] px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#2B2B2B]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FEF4E8] text-[#B26B1B] dark:bg-[#3A2B1D] dark:text-[#F5C78F]">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] truncate">{item.name}</span>
                      <span className="block text-xs text-gray-500 dark:text-[#787774]">
                        {item.available_quantity ?? item.initial_quantity ?? 0} disponibles · umbral {item.notification_threshold || 0}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
