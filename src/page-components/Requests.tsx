'use client'
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Check, X, ShieldAlert, UserCircle2, PackageCheck, MapPin, FileText, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRequests, useLoans, useIsDepartmentLeader, useManagedScopes } from '@/lib/hooks';
import { allocateAndCreateLoans } from '@/lib/loanAllocation';
import { supabase } from '@/lib/supabase/client';
import { RecursosEnUsoTab } from '@/page-components/Loans';

// Mock units for assignment - in production this would be fetched from DB
const AVAILABLE_UNITS = [
  { id: 'IPAD-001', serial: 'SN-987654321', condition: 'Excelente' },
  { id: 'IPAD-004', serial: 'SN-987654324', condition: 'Bueno' },
  { id: 'IPAD-005', serial: 'SN-987654325', condition: 'Excelente' },
  { id: 'IPAD-006', serial: 'SN-987654326', condition: 'Bueno' },
  { id: 'IPAD-007', serial: 'SN-987654327', condition: 'Excelente' },
  { id: 'IPAD-008', serial: 'SN-987654328', condition: 'Bueno' },
];

function RequestsInner() {
  const router = useRouter();
  const { role } = useRole();
  const { user } = useAuth();
  const { requests, loading, refetchRequests } = useRequests();
  const { loans, refetchLoans } = useLoans();
  const isDepartmentLeader = useIsDepartmentLeader(user?.id);
  const { managedDepartmentIds, managedLocationIds } = useManagedScopes(user?.id);
  const canAccessGestion = role === 'admin' || role === 'approver' || isDepartmentLeader;
  const [tab, setTab] = useState<'solicitudes' | 'en-uso'>('solicitudes');
  const [roleView, setRoleView] = useState<'admin' | 'user'>(role === 'admin' || role === 'approver' || isDepartmentLeader ? 'admin' : 'user');
  const searchParams = useSearchParams();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [detailRequest, setDetailRequest] = useState<any>(null);
  const [returnSuccessId, setReturnSuccessId] = useState<string | null>(null);
  const [returnLoadingId, setReturnLoadingId] = useState<string | null>(null);
  const [consumableMovements, setConsumableMovements] = useState<any[]>([]);
  const [hiddenMovementIds, setHiddenMovementIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('gestion.hiddenConsumableMovements');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const loadConsumableMovements = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name)')
        .eq('action', 'consumable_checkout')
        .order('created_at', { ascending: false })
        .limit(6);
      setConsumableMovements(data ?? []);
    };
    loadConsumableMovements();
  }, []);

  useEffect(() => {
    localStorage.setItem('gestion.hiddenConsumableMovements', JSON.stringify(hiddenMovementIds));
  }, [hiddenMovementIds]);

  const toggleUnitSelection = (unitId: string) => {
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter(id => id !== unitId));
    } else if (selectedUnits.length < (selectedRequest?.quantity || 1)) {
      setSelectedUnits([...selectedUnits, unitId]);
    }
  };

  const handleApproveClick = (req: any) => {
    setSelectedRequest(req);
    setAssignModalOpen(true);
    setSelectedUnits([]);
  };

  /** Aprobar y crear préstamos de inmediato (un clic), sin modal. */
  const handleApproveDirect = async (req: any) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'approved',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', req.id);
      if (error) throw error;
      await allocateAndCreateLoans(supabase, req, user.id);
      try {
        const resourceLabel = req.resources?.name ? (req.quantity > 1 ? `${req.resources.name} (x${req.quantity})` : req.resources.name) : 'recurso';
        await supabase.from('activity_logs').insert({
          action: 'request_approved',
          entity_type: 'request',
          entity_id: req.id,
          user_id: user.id,
          details: { message: `Solicitud de ${resourceLabel} aprobada`, actor_name: user?.user_metadata?.full_name },
        });
      } catch (_) {}
      refetchRequests?.();
      refetchLoans?.();
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar la solicitud.');
    }
  };

  const handleConfirmAssignment = async () => {
    if (!user?.id || !selectedRequest) return;
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'approved',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await allocateAndCreateLoans(supabase, selectedRequest, user.id);

      try {
        const resourceLabel = selectedRequest.resources?.name ? (selectedRequest.quantity > 1 ? `${selectedRequest.resources.name} (x${selectedRequest.quantity})` : selectedRequest.resources.name) : 'recurso';
        await supabase.from('activity_logs').insert({
          action: 'request_approved',
          entity_type: 'request',
          entity_id: selectedRequest.id,
          user_id: user.id,
          details: { message: `Solicitud de ${resourceLabel} aprobada`, actor_name: user?.user_metadata?.full_name },
        });
      } catch (_) {}

      setAssignModalOpen(false);
      refetchRequests?.();
      refetchLoans?.();
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar la solicitud.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: newStatus,
          processed_by: user?.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      try {
        const verb = newStatus === 'approved' ? 'aprobada' : newStatus === 'rejected' ? 'rechazada' : newStatus;
        await supabase.from('activity_logs').insert({
          action: `request_${newStatus}`,
          entity_type: 'request',
          entity_id: id,
          user_id: user?.id,
          details: { message: `Solicitud ${verb}`, actor_name: user?.user_metadata?.full_name }
        });
      } catch (_) {}
      refetchRequests?.();
    } catch (err) {
      console.error('Error changing request status:', err);
    }
  };

  /** Marcar como devueltos todos los préstamos asociados a una solicitud aprobada. */
  const handleMarkReturned = async (req: { id: string; resources?: { name?: string }; quantity?: number }) => {
    setReturnLoadingId(req.id);
    try {
      const { data: requestLoans, error: loansErr } = await supabase
        .from('loans')
        .select('id, unit_id')
        .eq('request_id', req.id)
        .neq('status', 'returned');
      if (loansErr) throw loansErr;
      if (!requestLoans?.length) {
        setReturnLoadingId(null);
        toast.info('No hay préstamos activos para esta solicitud.');
        return;
      }
      const returnDate = new Date().toISOString().split('T')[0];
      for (const loan of requestLoans) {
        const { error: upLoan } = await supabase.from('loans').update({ status: 'returned', return_date: returnDate }).eq('id', loan.id);
        if (upLoan) throw upLoan;
        if (loan.unit_id) {
          const { error: upUnit } = await supabase.from('resource_units').update({ status: 'available' }).eq('id', loan.unit_id);
          if (upUnit) throw upUnit;
        }
      }
      await refetchRequests?.();
      await refetchLoans?.();
      setReturnSuccessId(req.id);
      setTimeout(() => setReturnSuccessId(null), 5000);
    } catch (err) {
      console.error('Error marking returned:', err);
      toast.error(err instanceof Error ? err.message : 'No se pudo marcar la devolución.');
    } finally {
      setReturnLoadingId(null);
    }
  };

  /** Para cada solicitud aprobada, comprobar si todos sus préstamos están devueltos. */
  const isRequestFullyReturned = (requestId: string) => {
    const requestLoans = loans.filter((l: { request_id?: string }) => l.request_id === requestId);
    return requestLoans.length > 0 && requestLoans.every((l: { status?: string }) => l.status === 'returned');
  };
  /** Fecha de devolución de una solicitud (del primer préstamo devuelto). */
  const getReturnDateForRequest = (requestId: string) => {
    const returned = loans.find((l: { request_id?: string; status?: string; return_date?: string }) => l.request_id === requestId && l.status === 'returned');
    return returned?.return_date;
  };
  /** Numeración (nº de serie) de las unidades asignadas a una solicitud. */
  const getSerialNumbersForRequest = (requestId: string) => {
    const requestLoans = loans.filter((l: { request_id?: string }) => l.request_id === requestId);
    return requestLoans
      .map((l: { resource_units?: { serial_number?: string } }) => l.resource_units?.serial_number)
      .filter(Boolean) as string[];
  };

  /** Solo admin o el encargado del departamento del recurso puede aprobar. Si el recurso no tiene departamento, admin o approver. */
  const canApproveRequest = (req: { resources?: { department_id?: string; location_id?: string; departments?: { leader_id?: string } } }) => {
    if (role === 'admin') return true;
    const deptId = req.resources?.department_id;
    const leaderId = req.resources?.departments?.leader_id;
    const locationId = req.resources?.location_id;
    if (deptId && leaderId) return user?.id === leaderId;
    if (deptId && managedDepartmentIds.includes(deptId)) return true;
    if (locationId && managedLocationIds.includes(locationId)) return true;
    if (!deptId && role === 'approver') return true;
    return false;
  };

  // Filter requests based on role view (admin can see all or only their own)
  const baseRequests = roleView === 'admin'
    ? requests
    : requests.filter(req => req.user_id === user?.id);
  const statusParam = searchParams.get('status');
  const urgencyParam = searchParams.get('urgency');
  const displayRequests = baseRequests.filter(req => {
    if (statusParam && req.status !== statusParam) return false;
    if (urgencyParam && req.urgency !== urgencyParam) return false;
    return true;
  });
  const hasActiveFilters = Boolean(statusParam || urgencyParam);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Banner: recursos devueltos */}
      {returnSuccessId && (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-success-800 text-sm font-medium flex items-center gap-2">
          <PackageCheck className="w-5 h-5 shrink-0 text-success-600" />
          <span>Devolución registrada. Los recursos están disponibles de nuevo.</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">
            {canAccessGestion ? 'Gestión' : 'Mis solicitudes'}
          </h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">
            {canAccessGestion
              ? 'Solicitudes entrantes y recursos en uso. Aprueba, rechaza o confirma devoluciones.'
              : 'Historial de tus solicitudes enviadas.'}
          </p>
          {canAccessGestion && (
            <div className="mt-3 flex items-center gap-2 border-b border-gray-200 dark:border-[#3A3A3A]">
              <button
                type="button"
                onClick={() => setTab('solicitudes')}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === 'solicitudes' ? 'border-gray-900 text-gray-900 dark:text-[#E8E8E6]' : 'border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]'
                )}
              >
                Solicitudes
              </button>
              <button
                type="button"
                onClick={() => setTab('en-uso')}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === 'en-uso' ? 'border-gray-900 text-gray-900 dark:text-[#E8E8E6]' : 'border-transparent text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]'
                )}
              >
                Recursos en Uso
              </button>
            </div>
          )}
        </div>

        {tab === 'solicitudes' && (
        <>
        {/* Vista: Solicitudes recibidas (admin) vs Mis solicitudes (usuario) */}
        {(role === 'admin' || role === 'approver' || isDepartmentLeader) && (
          <div className="flex items-center bg-gray-100 dark:bg-[#2A2A2A] p-1 rounded-lg border border-gray-200 dark:border-[#3A3A3A]">
            <button
              onClick={() => setRoleView('admin')}
              className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2", roleView === 'admin' ? "bg-white dark:bg-[#242424] shadow-sm text-gray-900 dark:text-[#E8E8E6]" : "text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]")}
            >
              <ShieldAlert className="w-4 h-4" /> Solicitudes recibidas
            </button>
            <button
              onClick={() => setRoleView('user')}
              className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2", roleView === 'user' ? "bg-white dark:bg-[#242424] shadow-sm text-gray-900 dark:text-[#E8E8E6]" : "text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6]")}
            >
              <UserCircle2 className="w-4 h-4" /> Mis solicitudes
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {tab === 'en-uso' && canAccessGestion ? (
        <RecursosEnUsoTab embedded />
      ) : (
        <>
      {canAccessGestion && consumableMovements.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#242424] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Retiros consumibles recientes</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                Movimientos directos de stock que no pasan por préstamo ni devolución.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hiddenMovementIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHiddenMovementIds([])}
                >
                  Deshacer avisos
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {consumableMovements.filter((entry) => !hiddenMovementIds.includes(entry.id)).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-gray-50 px-4 py-3 text-left transition-colors dark:bg-[#1D1D1D]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{entry.details?.resource_name ?? 'Consumible'}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                      {entry.profiles?.full_name || entry.details?.actor_name || 'Usuario'} retiro {entry.details?.quantity ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40">
                      Stock
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setHiddenMovementIds((prev) => [...new Set([...prev, entry.id])])}
                      className="rounded-md px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:text-[#787774] dark:hover:bg-white/[0.06] dark:hover:text-[#E8E8E6]"
                    >
                      Ocultar
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/recursos/${entry.entity_id}`)}>
                    Abrir recurso
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* FILTROS Y CONTROLES */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
            <input
              type="text"
              placeholder="Buscar solicitudes por usuario o recurso..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow shadow-sm placeholder:text-gray-400 dark:placeholder:text-[#555]"
            />
          </div>
        </div>

        {/* Filtros: Estado y Urgencia */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-[#787774] font-medium">Estado:</span>
            {['pending', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (statusParam === s) next.delete('status');
                  else next.set('status', s);
                  router.push('?' + next.toString());
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  statusParam === s
                    ? "bg-gray-900 text-white border border-gray-900"
                    : "bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                )}
              >
                {s === 'pending' ? 'Pendiente' : s === 'approved' ? 'Aprobado' : 'Rechazado'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-[#787774] font-medium">Urgencia:</span>
            {['normal', 'high'].map((u) => (
              <button
                key={u}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (urgencyParam === u) next.delete('urgency');
                  else next.set('urgency', u);
                  router.push('?' + next.toString());
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  urgencyParam === u
                    ? "bg-gray-900 text-white border border-gray-900"
                    : "bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                )}
              >
                {u === 'high' ? 'Alta' : 'Normal'}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => router.push('?')}
              className="text-xs font-medium text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
          {displayRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-gray-400 dark:text-[#555]" />
              </div>
              <p className="font-medium text-gray-900 dark:text-[#E8E8E6] text-sm">Sin solicitudes pendientes</p>
              <p className="text-xs text-gray-400 dark:text-[#555]">Las solicitudes de recursos aparecerán aquí.</p>
            </div>
          ) : (
            displayRequests.map((req) => (
              <div key={req.id} className="p-6 hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between group">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Resource & User Info */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6] group-hover:text-black dark:group-hover:text-white transition-colors">{req.resources?.name}</h3>
                          <Badge variant="neutral" className="bg-gray-100 dark:bg-[#2A2A2A]">Cantidad: {req.quantity}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">{req.resources?.sku ?? '—'} • {new Date(req.created_at).toLocaleDateString('es-ES')}</p>
                        {req.status === 'approved' && (() => {
                          const serials = getSerialNumbersForRequest(req.id);
                          if (serials.length > 0) return <p className="text-xs text-gray-600 dark:text-[#AAAAAA] mt-1">Numeración: {serials.join(', ')}</p>;
                          return null;
                        })()}
                        {req.resources?.locations?.name && (
                          <p className="text-xs text-gray-600 dark:text-[#AAAAAA] mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            Devolver en: {req.resources.locations.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === 'pending' && <Badge variant="warning" className="bg-warning-50 dark:bg-amber-950/20 text-warning-700 dark:text-amber-400 border-warning-200">Pendiente</Badge>}
                        {req.status === 'approved' && (
                          isRequestFullyReturned(req.id) ? (
                            <Badge variant="neutral" className="bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#C8C8C6] border-gray-200 dark:border-[#3A3A3A]" title={getReturnDateForRequest(req.id) ? `Devuelto el ${new Date(getReturnDateForRequest(req.id)!).toLocaleDateString('es-ES')}` : undefined}>
                              Devuelto{getReturnDateForRequest(req.id) ? ` (${new Date(getReturnDateForRequest(req.id)!).toLocaleDateString('es-ES')})` : ''}
                            </Badge>
                          ) : (
                            <Badge variant="success" className="bg-success-50 dark:bg-emerald-950/30 text-success-700 dark:text-emerald-400 border-success-200 dark:border-emerald-900/40">Aprobado</Badge>
                          )
                        )}
                        {req.status === 'rejected' && <Badge variant="error" className="bg-error-50 dark:bg-red-950/20 text-error-700 dark:text-red-400 border-error-200 dark:border-red-900/40">Rechazado</Badge>}
                        {req.urgency === 'high' && <Badge variant="error" className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40">Urgente</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#1D1D1D] p-3 rounded-xl">
                      <img src={req.profiles?.avatar_url || `https://i.pravatar.cc/150?u=${req.profiles?.id}`} alt="" className="w-10 h-10 rounded-full border border-gray-200 dark:border-[#3A3A3A]" referrerPolicy="no-referrer" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{req.profiles?.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#787774]">{req.profiles?.job_title} • {req.profiles?.departments?.name || 'General'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dates & Reason */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-[#787774] text-xs uppercase tracking-wider font-semibold mb-1">Fecha de uso</p>
                        <p className="font-medium text-gray-900 dark:text-[#E8E8E6]">
                          {new Date(
                            req.needed_from ?? (req as { start_date?: string }).start_date ?? req.created_at
                          ).toLocaleDateString()}
                          {' '}-{' '}
                          {new Date(
                            req.needed_until ?? (req as { end_date?: string }).end_date ?? req.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-[#787774] text-xs uppercase tracking-wider font-semibold mb-1">Solicitado el</p>
                        <p className="text-gray-700 dark:text-[#C8C8C6]">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-[#787774] text-xs uppercase tracking-wider font-semibold mb-1">Motivo</p>
                      <p className="text-sm text-gray-700 dark:text-[#C8C8C6] bg-gray-50 dark:bg-[#1D1D1D] p-2.5 rounded-lg">{req.notes || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Actions based on Role */}
                <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-auto shrink-0 pt-4 lg:pt-0 lg:pl-6">
                  {roleView === 'admin' ? (
                    req.status === 'pending' ? (
                      <>
                        <Button
                          variant="primary"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                          onClick={() => handleApproveDirect(req)}
                          disabled={!canApproveRequest(req)}
                          title={!canApproveRequest(req) ? 'Solo el encargado del departamento de este recurso puede aprobar' : undefined}
                        >
                          <Check className="w-4 h-4 mr-2" /> Aprobar
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full bg-white dark:bg-[#242424] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/40"
                          onClick={() => handleStatusChange(req.id, 'rejected')}
                          disabled={!canApproveRequest(req)}
                          title={!canApproveRequest(req) ? 'Solo el encargado del departamento puede gestionar' : undefined}
                        >
                          <X className="w-4 h-4 mr-2" /> Rechazar
                        </Button>
                      </>
                    ) : req.status === 'approved' ? (
                      isRequestFullyReturned(req.id) ? (
                        <>
                          <span className="text-sm text-gray-500 dark:text-[#787774] font-medium">
                            Recursos devueltos{getReturnDateForRequest(req.id) ? ` el ${new Date(getReturnDateForRequest(req.id)!).toLocaleDateString('es-ES')}` : ''}
                          </span>
                          <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                            Ver Detalles
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                            onClick={() => handleMarkReturned(req)}
                            disabled={returnLoadingId === req.id}
                          >
                            {returnLoadingId === req.id ? (
                              <>Procesando…</>
                            ) : (
                              <><PackageCheck className="w-4 h-4 mr-2" /> Confirmar devolución</>
                            )}
                          </Button>
                          <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                            Ver Detalles
                          </Button>
                        </>
                      )
                    ) : (
                      <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                        Ver Detalles
                      </Button>
                    )
                  ) : (
                    req.status === 'pending' ? (
                      <Button
                        variant="secondary"
                        className="w-full bg-white dark:bg-[#242424] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/40"
                        onClick={() => handleStatusChange(req.id, 'rejected')}
                      >
                        Cancelar Solicitud
                      </Button>
                    ) : req.status === 'approved' ? (
                      isRequestFullyReturned(req.id) ? (
                        <>
                          <span className="text-sm text-gray-500 dark:text-[#787774] font-medium">
                            Recursos devueltos{getReturnDateForRequest(req.id) ? ` el ${new Date(getReturnDateForRequest(req.id)!).toLocaleDateString('es-ES')}` : ''}
                          </span>
                          <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                            Ver Detalles
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                            onClick={() => handleMarkReturned(req)}
                            disabled={returnLoadingId === req.id}
                          >
                            {returnLoadingId === req.id ? (
                              <>Procesando…</>
                            ) : (
                              <><PackageCheck className="w-4 h-4 mr-2" /> Marcar devuelto</>
                            )}
                          </Button>
                          <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                            Ver Detalles
                          </Button>
                        </>
                      )
                    ) : (
                      <Button variant="secondary" className="w-full bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA]" onClick={() => setDetailRequest(req)}>
                        Ver Detalles
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </>
      )}

      {/* Assignment Modal for Bulk Requests */}
      {assignModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Asignar Unidades</h2>
                <p className="text-sm text-gray-500 dark:text-[#787774] mt-1">
                  Selecciona {selectedRequest.quantity ?? 1} unidades de {selectedRequest.resources?.name ?? 'recurso'} para {selectedRequest.profiles?.full_name ?? 'solicitante'}
                </p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-400 dark:text-[#555] hover:text-gray-500 dark:hover:text-[#787774]">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
                  Seleccionadas: {selectedUnits.length} / {selectedRequest.quantity}
                </span>
                {selectedUnits.length === selectedRequest.quantity && (
                  <span className="text-sm text-success-600 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Cantidad completada
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_UNITS.map(unit => {
                  const isSelected = selectedUnits.includes(unit.id);
                  const isDisabled = !isSelected && selectedUnits.length >= selectedRequest.quantity;

                  return (
                    <div
                      key={unit.id}
                      onClick={() => !isDisabled && toggleUnitSelection(unit.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-black dark:border-[#E8E8E6] bg-gray-50 dark:bg-[#1D1D1D] ring-1 ring-black dark:ring-[#E8E8E6]'
                          : isDisabled
                            ? 'border-gray-200 dark:border-[#3A3A3A] opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-[#3A3A3A] hover:border-gray-300 dark:hover:border-[#444]'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-[#E8E8E6]">{unit.id}</p>
                        <p className="text-xs text-gray-500 dark:text-[#787774] font-mono mt-1">{unit.serial}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="neutral" className="text-xs bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#C8C8C6] border-gray-200 dark:border-[#3A3A3A]">{unit.condition}</Badge>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-black border-black text-white' : 'border-gray-300 dark:border-[#444]'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 flex justify-end gap-3 bg-gray-50 dark:bg-[#1D1D1D] rounded-b-xl">
              <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={handleConfirmAssignment}
                disabled={selectedUnits.length !== selectedRequest.quantity}
                className="bg-black text-white hover:bg-gray-800"
              >
                Confirmar Asignación y Aprobar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalles */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailRequest(null)}>
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2"><FileText className="w-5 h-5" /> Detalle de la solicitud</h2>
              <button type="button" onClick={() => setDetailRequest(null)} className="p-1 rounded-lg text-gray-400 dark:text-[#555] hover:bg-gray-100 dark:hover:bg-[#333]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-500 dark:text-[#787774] font-medium">Recurso:</span> {detailRequest.resources?.name ?? '—'} <span className="font-medium">Cantidad: {detailRequest.quantity ?? 1}</span></p>
              {detailRequest.id && getSerialNumbersForRequest(detailRequest.id).length > 0 && (
                <p><span className="text-gray-500 dark:text-[#787774] font-medium">Numeración asignada:</span> {getSerialNumbersForRequest(detailRequest.id).join(', ')}</p>
              )}
              <p><span className="text-gray-500 dark:text-[#787774] font-medium">Solicitante:</span> {detailRequest.profiles?.full_name ?? '—'} • {detailRequest.profiles?.departments?.name ?? 'General'}</p>
              <p><span className="text-gray-500 dark:text-[#787774] font-medium">Estado:</span> {detailRequest.status === 'pending' ? 'Pendiente' : detailRequest.status === 'approved' ? (isRequestFullyReturned(detailRequest.id) ? 'Devuelto' : 'Aprobado') : 'Rechazado'}</p>
              <p><span className="text-gray-500 dark:text-[#787774] font-medium">Fecha solicitud:</span> {new Date(detailRequest.created_at).toLocaleString('es-ES')}</p>
              {isRequestFullyReturned(detailRequest.id) && getReturnDateForRequest(detailRequest.id) && (
                <p><span className="text-gray-500 dark:text-[#787774] font-medium">Devuelto el:</span> {new Date(getReturnDateForRequest(detailRequest.id)!).toLocaleDateString('es-ES')}</p>
              )}
              {detailRequest.resources?.locations?.name && <p><span className="text-gray-500 dark:text-[#787774] font-medium">Devolver en:</span> {detailRequest.resources.locations.name}</p>}
              <div><span className="text-gray-500 dark:text-[#787774] font-medium block mb-1">Motivo / notas:</span><p className="text-gray-700 dark:text-[#C8C8C6] bg-gray-50 dark:bg-[#1D1D1D] p-2 rounded-lg">{detailRequest.notes || '—'}</p></div>
            </div>
            <div className="mt-4 pt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailRequest(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Requests() {
  return <Suspense><RequestsInner /></Suspense>
}
