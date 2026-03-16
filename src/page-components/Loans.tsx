'use client'
import { useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, AlertTriangle, Clock, Mail, CheckCircle2, ArrowRightLeft, ChevronDown, Check, RefreshCw, Flag, ClipboardList, Package, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useLoans } from '@/lib/hooks';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type LoanRow = { id: string; unit_id?: string; status?: string; due_date?: string };

type RecursosEnUsoTabProps = { embedded?: boolean };

/** Contenido reutilizable: tarjetas, filtros, tabla y dropdown de Recursos en Uso. */
function RecursosEnUsoTabInner({ embedded = false }: RecursosEnUsoTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { loans, loading, error: loansError, refetchLoans } = useLoans();
  const searchParams = useSearchParams();
  const initialStatus = (() => {
    const s = searchParams.get('status');
    if (s === 'overdue' || s === 'active' || s === 'due_today') return s;
    return null;
  })();
  const [statusFilter, setStatusFilter] = useState<string | null>(initialStatus);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [damageModalLoan, setDamageModalLoan] = useState<any | null>(null);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageSubmitting, setDamageSubmitting] = useState(false);

  const handleMarkReturned = async (loan: LoanRow) => {
    if (!loan.unit_id) return;
    setActionLoading(loan.id);
    try {
      await supabase.from('loans').update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] }).eq('id', loan.id);
      await supabase.from('resource_units').update({ status: 'available' }).eq('id', loan.unit_id);
      closeDropdown();
      refetchLoans?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'No se pudo marcar la devolución.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendLoan = async (loan: LoanRow) => {
    if (!loan.due_date) return;
    const next = new Date(loan.due_date);
    next.setDate(next.getDate() + 7);
    const newDue = next.toISOString().split('T')[0];
    setActionLoading(loan.id);
    try {
      await supabase.from('loans').update({ due_date: newDue }).eq('id', loan.id);
      closeDropdown();
      refetchLoans?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'No se pudo extender.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportDamage = (loan: any) => {
    closeDropdown();
    setDamageNotes('');
    setDamageModalLoan(loan);
  };

  const closeDamageModal = () => {
    if (damageSubmitting) return;
    setDamageModalLoan(null);
    setDamageNotes('');
  };

  const submitDamageReport = async () => {
    if (!damageModalLoan?.unit_id) return;
    setDamageSubmitting(true);
    try {
      const { error: updateLoanError } = await supabase
        .from('loans')
        .update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] })
        .eq('id', damageModalLoan.id);
      if (updateLoanError) throw updateLoanError;

      const { error: updateUnitError } = await supabase
        .from('resource_units')
        .update({ status: 'maintenance', condition: damageNotes.trim() || 'reported_issue' })
        .eq('id', damageModalLoan.unit_id);
      if (updateUnitError) throw updateUnitError;

      try {
        await supabase.from('activity_logs').insert({
          action: 'damage_reported',
          entity_type: 'loan',
          entity_id: damageModalLoan.id,
          user_id: user?.id,
          details: {
            message: `Daño reportado en ${damageModalLoan.resource_units?.resources?.name ?? 'recurso'}`,
            serial_number: damageModalLoan.resource_units?.serial_number ?? null,
            notes: damageNotes.trim() || null,
          },
        });
      } catch (_) {}

      closeDamageModal();
      refetchLoans?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'No se pudo registrar el daño.');
    } finally {
      setDamageSubmitting(false);
    }
  };

  const openDropdown = (loanId: string, e: React.MouseEvent) => {
    const isOpen = activeDropdown === loanId;
    if (isOpen) {
      setActiveDropdown(null);
      setDropdownPosition(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setActiveDropdown(loanId);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
    setDropdownPosition(null);
  };

  const activeLoans = loans.filter((l: { status?: string }) => l.status !== 'returned');
  const filteredLoans = activeLoans.filter(loan => {
    if (!statusFilter) return true;
    if (statusFilter === 'due_today') {
      const today = new Date().toISOString().split('T')[0];
      return loan.due_date === today;
    }
    return loan.status === statusFilter;
  });

  const overdueCount = activeLoans.filter(l => l.status === 'overdue').length;
  const dueTodayCount = activeLoans.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.due_date === today;
  }).length;
  const inTimeCount = activeLoans.filter(l => l.status === 'active').length;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Recursos en Uso</h1>
            <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">Recursos actualmente asignados. Usa el menú Gestionar para devoluciones o extensiones.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => refetchLoans()}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar
            </Button>
            <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => router.push('/solicitudes')}>
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Ir a Solicitudes
            </Button>
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" className="bg-white dark:bg-[#242424]" onClick={() => refetchLoans()}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar
          </Button>
        </div>
      )}

      {/* Alert System Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-error-200 bg-error-50 dark:bg-red-950/20 flex items-center justify-center text-error-600 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : overdueCount}</p>
                <span className="text-xs font-medium text-error-600">Requiere atención</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Préstamo vencido</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className={cn("w-full mt-5 transition-colors", statusFilter === 'overdue' ? "bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] border-gray-300 dark:border-[#444]" : "bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA] hover:text-gray-900 dark:hover:text-[#E8E8E6]")}
            onClick={() => setStatusFilter(statusFilter === 'overdue' ? null : 'overdue')}
          >
            {statusFilter === 'overdue' ? 'Mostrando Vencidos' : 'Filtrar Vencidos'}
          </Button>
        </Card>
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-warning-200 bg-warning-50 dark:bg-amber-950/20 flex items-center justify-center text-warning-600 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : dueTodayCount}</p>
                <span className="text-xs font-medium text-warning-600">Devolución hoy</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Vence hoy</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className={cn("w-full mt-5 transition-colors", statusFilter === 'due_today' ? "bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] border-gray-300 dark:border-[#444]" : "bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA] hover:text-gray-900 dark:hover:text-[#E8E8E6]")}
            onClick={() => setStatusFilter(statusFilter === 'due_today' ? null : 'due_today')}
          >
            {statusFilter === 'due_today' ? 'Mostrando Vence Hoy' : 'Filtrar Vence Hoy'}
          </Button>
        </Card>
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-success-200 bg-success-50 dark:bg-emerald-950/30 flex items-center justify-center text-success-600 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loading ? '...' : inTimeCount}</p>
                <span className="text-xs font-medium text-success-600">En plazo</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">En tiempo</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className={cn("w-full mt-5 transition-colors", statusFilter === 'active' ? "bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6] border-gray-300 dark:border-[#444]" : "bg-white dark:bg-[#242424] text-gray-600 dark:text-[#AAAAAA] hover:text-gray-900 dark:hover:text-[#E8E8E6]")}
            onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
          >
            {statusFilter === 'active' ? 'Mostrando En Plazo' : 'Filtrar En Plazo'}
          </Button>
        </Card>
      </div>

      {/* Filtros: Estado */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#555] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por usuario o recurso..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent shadow-sm placeholder:text-gray-400 dark:placeholder:text-[#555]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-[#787774]">Estado:</span>
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              !statusFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
            )}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'overdue' ? null : 'overdue')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              statusFilter === 'overdue' ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
            )}
          >
            Vencido
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'due_today' ? null : 'due_today')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              statusFilter === 'due_today' ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
            )}
          >
            Vence hoy
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              statusFilter === 'active' ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
            )}
          >
            En plazo
          </button>
          {statusFilter !== null && (
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="text-xs font-medium text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loansError && (
        <div className="p-4 rounded-lg border border-error-200 dark:border-red-900/40 bg-error-50 dark:bg-red-950/20 text-error-700 dark:text-red-400 text-sm">
          Error al cargar recursos en uso: {loansError instanceof Error ? loansError.message : (loansError && typeof loansError === 'object' && 'message' in loansError ? String((loansError as { message: string }).message) : String(loansError))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#1D1D1D]">
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Recurso</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Asignado a</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Fecha Préstamo</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Vencimiento</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
              {filteredLoans.length > 0 ? (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className={cn("hover:bg-gray-50/80 dark:hover:bg-[#2A2A2A] transition-colors group", loan.status === 'overdue' && "bg-red-50/30 hover:bg-red-50/50")}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] group-hover:text-black dark:group-hover:text-white transition-colors">
                        {loan.resource_units?.resources?.name ?? 'Recurso'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-mono text-gray-500 dark:text-[#787774]">{loan.resource_units?.serial_number ?? '—'}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-[#AAAAAA] font-medium">
                          {loan.resource_units?.resources?.ownership_type ?? '—'}
                        </span>
                      </div>
                      {loan.resource_units?.resources?.locations?.name && (
                        <p className="text-xs text-gray-600 dark:text-[#AAAAAA] mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          Devolver en: {loan.resource_units.resources.locations.name}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={loan.profiles?.avatar_url || `https://i.pravatar.cc/150?u=${loan.profiles?.id}`}
                          alt=""
                          className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#3A3A3A]"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{loan.profiles?.full_name}</p>
                          <p className="text-xs text-gray-500 dark:text-[#787774]">{loan.profiles?.job_title} • {loan.profiles?.departments?.name ?? 'General'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#AAAAAA]">{new Date(loan.start_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={cn("text-sm font-medium", loan.status === 'overdue' ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-[#E8E8E6]")}>
                        {new Date(loan.due_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {loan.status === 'overdue' && <Badge variant="error" className="font-medium">Vencido</Badge>}
                      {loan.due_date === new Date().toISOString().split('T')[0] && <Badge variant="warning" className="font-medium">Vence hoy</Badge>}
                      {loan.status === 'active' && <Badge variant="success" className="font-medium">En uso</Badge>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {loan.status === 'overdue' ? (
                        <Button variant="secondary" size="sm" className="bg-white dark:bg-[#242424] text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300">
                          <Mail className="w-4 h-4 mr-2" /> Enviar Alerta
                        </Button>
                      ) : (
                        <div className="inline-block text-left">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white dark:bg-[#242424]"
                            onClick={(e) => openDropdown(loan.id, e)}
                          >
                            Gestionar <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    {loans.length === 0 && !loading ? (
                      <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center">
                          <Package className="w-7 h-7 text-gray-400 dark:text-[#555]" />
                        </div>
                        <div>
                          <p className="text-gray-700 dark:text-[#C8C8C6] font-medium">No hay préstamos en uso</p>
                          <p className="text-gray-500 dark:text-[#787774] text-sm mt-1 max-w-sm mx-auto">
                            Los recursos en uso aparecerán aquí cuando apruebes una solicitud desde <strong>Solicitudes</strong> o desde el <strong>Inicio</strong>. El recurso debe tener unidades disponibles.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Button variant="primary" size="sm" className="bg-gray-900 text-white" onClick={() => router.push('/solicitudes')}>
                            <ClipboardList className="w-4 h-4 mr-2" /> Ir a Solicitudes
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                            Ir al Inicio
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-[#787774] text-sm">No se encontraron préstamos con los filtros seleccionados.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown Gestionar: renderizado en portal para que no quede oculto */}
      {activeDropdown && dropdownPosition && typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              aria-hidden
              onClick={closeDropdown}
            />
            <div
              className="fixed z-[101] w-48 bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3A3A3A] rounded-xl shadow-lg overflow-hidden py-1"
              style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
              role="menu"
            >
              {(() => {
                const loan = loans.find((l: { id: string }) => l.id === activeDropdown);
                if (!loan) return null;
                return (
                  <>
                    <button
                      type="button"
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] disabled:opacity-50"
                      onClick={() => handleMarkReturned(loan)}
                      disabled={actionLoading === loan.id}
                    >
                      <Check className="w-4 h-4 mr-2 text-success-500 shrink-0" /> {actionLoading === loan.id ? '…' : 'Marcar Devuelto'}
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] disabled:opacity-50"
                      onClick={() => handleExtendLoan(loan)}
                      disabled={actionLoading === loan.id}
                    >
                      <RefreshCw className="w-4 h-4 mr-2 text-blue-500 shrink-0" /> {actionLoading === loan.id ? '…' : 'Extender Préstamo'}
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center px-4 py-2 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-red-950/20"
                      onClick={() => handleReportDamage(loan)}
                    >
                      <Flag className="w-4 h-4 mr-2 shrink-0" /> Reportar Daño
                    </button>
                  </>
                );
              })()}
            </div>
          </>,
          document.body
        )}

      {damageModalLoan && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#242424] shadow-xl">
              <div className="flex items-center justify-between p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Reportar daño</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                    La unidad pasará a mantenimiento y se cerrará el préstamo activo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDamageModal}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-[#555] dark:hover:bg-[#2A2A2A] dark:hover:text-[#AAAAAA]"
                >
                  <Check className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <div className="space-y-4 px-5 pb-5">
                <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-[#1D1D1D]">
                  <p className="font-medium text-gray-900 dark:text-[#E8E8E6]">
                    {damageModalLoan.resource_units?.resources?.name ?? 'Recurso'}
                  </p>
                  <p className="mt-1 text-gray-500 dark:text-[#787774]">
                    Unidad: <span className="font-mono">{damageModalLoan.resource_units?.serial_number ?? '—'}</span>
                  </p>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
                    Observación del daño
                  </span>
                  <textarea
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    rows={4}
                    placeholder="Ej. pantalla rota, batería defectuosa, carcasa agrietada…"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#E8E8E6] dark:focus:border-[#E8E8E6] dark:focus:ring-[#E8E8E6]/10"
                  />
                </label>
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" className="flex-1" onClick={closeDamageModal} disabled={damageSubmitting}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                    onClick={submitDamageReport}
                    disabled={damageSubmitting}
                  >
                    {damageSubmitting ? 'Guardando…' : 'Registrar incidencia'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/** Página standalone de Recursos en Uso (ruta /prestamos). */
export function RecursosEnUsoTab({ embedded = false }: RecursosEnUsoTabProps) {
  return <Suspense><RecursosEnUsoTabInner embedded={embedded} /></Suspense>
}

export function Loans() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <RecursosEnUsoTab />
    </div>
  );
}
