'use client'
import { useState, useEffect, useMemo, Suspense } from 'react';
import { Search, Filter, Plus, Minus, Trash2, Calendar, CheckCircle2, Package, Clock, MapPin, Save, ChevronDown, ShoppingCart } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useResources } from '@/lib/hooks';
import { useRole } from '@/contexts/RoleContext';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { isVisibleInCatalog } from '@/lib/resourceVisibility';
import { compareIsoDate, dateRangesOverlap, formatAgendaTimeLabel, formatTimeRange, rangesOverlap, toIsoDate } from '@/lib/scheduling';

interface RequestItem {
  resourceId: string;
  name: string;
  quantity: number;
  maxAvailable: number;
  resourceType?: 'reusable' | 'consumable';
  procurementOnly?: boolean;
  /** Ubicación donde devolver el recurso */
  locationName?: string;
  /** 'auto' = asignar según disponibilidad; 'pick' = usuario elige unidades por nº de serie */
  assignMode?: 'auto' | 'pick';
  /** IDs de unidades elegidas por el usuario (solo si assignMode === 'pick') */
  selectedUnitIds?: string[];
}

interface UnitOption {
  id: string;
  serial_number: string | null;
  status: string;
}

interface ScheduleConflict {
  id: string;
  resource_id: string;
  status: string;
  needed_from?: string | null;
  needed_until?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  user_id?: string | null;
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

function RequestResourceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { role } = useRole();
  const preSelectedId = searchParams.get('resource');

  const [searchTerm, setSearchTerm] = useState('');
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [useLocation, setUseLocation] = useState('');
  const [reason, setReason] = useState('');
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUnitsByResource, setAvailableUnitsByResource] = useState<Record<string, UnitOption[]>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [requestDetailsCollapsed, setRequestDetailsCollapsed] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState<ScheduleConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [scheduleLoad, setScheduleLoad] = useState<Record<string, ScheduleConflict[]>>({});

  const { resources, loading: resourcesLoading } = useResources();

  // Cargar unidades disponibles (por nº de serie) para recursos con cantidad > 1
  useEffect(() => {
    const ids = requestItems.filter((i) => i.quantity > 1).map((i) => i.resourceId);
    if (ids.length === 0) {
      setAvailableUnitsByResource({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      const next: Record<string, UnitOption[]> = {};
      for (const rid of ids) {
        const { data } = await supabase
          .from('resource_units')
          .select('id, serial_number, status')
          .eq('resource_id', rid)
          .eq('status', 'available')
          .order('serial_number')
          .limit(50);
        if (!cancelled) next[rid] = data ?? [];
      }
      if (!cancelled) setAvailableUnitsByResource(next);
    };
    load();
    return () => { cancelled = true; };
  }, [requestItems.filter((i) => i.quantity > 1).map((i) => i.resourceId).sort().join(',')]);

  useEffect(() => {
    if (preSelectedId && resources.length > 0) {
      const resource = resources.find(r => r.id === preSelectedId);
      if (resource && !requestItems.find(item => item.resourceId === resource.id)) {
        setRequestItems([{
          resourceId: resource.id,
          name: resource.name,
          quantity: 1,
          maxAvailable: resource.available_quantity || 0,
          resourceType: resource.type,
          procurementOnly: resource.type === 'consumable' && (resource.available_quantity ?? 0) <= 0,
          locationName: resource.locations?.name,
          assignMode: 'auto'
        }]);
        setSearchTerm(resource.name); // Filter catalog visually automatically
      }
    }
  }, [preSelectedId, resources]);

  useEffect(() => {
    const saved = localStorage.getItem('requestTemplate');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setUseLocation(data.useLocation || '');
        setStartTime(data.startTime || '');
        setEndTime(data.endTime || '');
        setReason(data.reason || '');
      } catch (e) {
        console.error('Error loading template', e);
      }
    }
  }, []);

  const visibleCatalog = useMemo(
    () => resources.filter((item) => {
      if (role === 'admin') return true;
      return isVisibleInCatalog(item, false);
    }),
    [resources, role]
  );

  const filteredCatalog = visibleCatalog.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categories?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = (resource: any) => {
    const existing = requestItems.find(item => item.resourceId === resource.id);
    const avail = resource.available_quantity ?? 0;
    if (existing) {
      const maxQ = avail > 0 ? avail : 99;
      if (existing.quantity < maxQ) {
        setRequestItems(requestItems.map(item =>
          item.resourceId === resource.id ? { ...item, quantity: item.quantity + 1 } : item
        ));
      }
    } else {
        setRequestItems([...requestItems, {
          resourceId: resource.id,
          name: resource.name,
          quantity: 1,
          maxAvailable: avail > 0 ? avail : 99,
          resourceType: resource.type,
          procurementOnly: resource.type === 'consumable' && avail <= 0,
          locationName: resource.locations?.name,
          assignMode: 'auto'
        }]);
    }
  };

  const allSelectedConsumables = requestItems.length > 0 && requestItems.every((item) => item.resourceType === 'consumable');
  const hasReusableItems = requestItems.some((item) => item.resourceType !== 'consumable');
  const hasConsumableItems = requestItems.some((item) => item.resourceType === 'consumable');
  const hasProcurementItems = requestItems.some((item) => item.procurementOnly);
  const reusableItems = useMemo(
    () => requestItems.filter((item) => item.resourceType !== 'consumable'),
    [requestItems]
  );

  const toggleItemExpanded = (resourceId: string) => {
    setExpandedItems((prev) => ({ ...prev, [resourceId]: !prev[resourceId] }));
  };

  const getDeliveryEstimate = (resource: any) => {
    const available = Number(resource?.available_quantity ?? 0);
    if (resource?.type === 'consumable') {
      if (available > 0) return { label: 'Retiro estimado', value: 'Hoy mismo', tone: 'text-blue-600 dark:text-blue-400' };
      return { label: 'Abastecimiento', value: 'Compra requerida', tone: 'text-amber-600 dark:text-amber-400' };
    }
    if (available > 0 && resource?.requires_approval === false) {
      return { label: 'Entrega estimada', value: 'Hoy mismo', tone: 'text-emerald-600 dark:text-emerald-400' };
    }
    if (available > 0) {
      return { label: 'Entrega estimada', value: '24 horas aprox.', tone: 'text-blue-600 dark:text-blue-400' };
    }
    return { label: 'Entrega estimada', value: 'Sujeto a devolución', tone: 'text-amber-600 dark:text-amber-400' };
  };

  useEffect(() => {
    const loadConflicts = async () => {
      const targetIds = visibleCatalog
        .filter((item) => item.type !== 'consumable')
        .map((item) => item.id);
      if (!startDate || !endDate || targetIds.length === 0) {
        setScheduleConflicts([]);
        setScheduleLoad({});
        return;
      }

      setConflictsLoading(true);
      try {
        let query = supabase
          .from('requests')
          .select('id, resource_id, status, needed_from, needed_until, start_time, end_time, user_id, profiles(full_name)')
          .in('resource_id', targetIds)
          .in('status', ['pending', 'approved'])
          .lte('needed_from', endDate)
          .gte('needed_until', startDate);

        if (user?.id) query = query.neq('user_id', user.id);
        const { data, error } = await query;
        if (error) throw error;

        const conflicts = (data ?? []).filter((entry: any) => {
          if (!dateRangesOverlap(startDate, endDate, entry.needed_from, entry.needed_until)) return false;
          return rangesOverlap(startTime, endTime, entry.start_time, entry.end_time);
        });
        const map = conflicts.reduce<Record<string, ScheduleConflict[]>>((acc, entry) => {
          if (!acc[entry.resource_id]) acc[entry.resource_id] = [];
          acc[entry.resource_id].push(entry as any);
          return acc;
        }, {});
        setScheduleLoad(map);
        setScheduleConflicts((conflicts.filter((entry) => reusableItems.some((item) => item.resourceId === entry.resource_id))) as any);
      } catch (conflictError: any) {
        const msg = String(conflictError?.message || '').toLowerCase();
        if (msg.includes('start_time') || msg.includes('end_time')) {
          const fallback = await supabase
            .from('requests')
            .select('id, resource_id, status, needed_from, needed_until, user_id, profiles(full_name)')
            .in('resource_id', targetIds)
            .in('status', ['pending', 'approved'])
            .lte('needed_from', endDate)
            .gte('needed_until', startDate);
          if (!fallback.error) {
            const conflicts = (fallback.data ?? []).filter((entry: any) =>
              dateRangesOverlap(startDate, endDate, entry.needed_from, entry.needed_until)
            );
            const map = conflicts.reduce<Record<string, ScheduleConflict[]>>((acc, entry) => {
              if (!acc[entry.resource_id]) acc[entry.resource_id] = [];
              acc[entry.resource_id].push(entry);
              return acc;
            }, {});
            setScheduleLoad(map);
            setScheduleConflicts(conflicts.filter((entry) => reusableItems.some((item) => item.resourceId === entry.resource_id)));
          }
        } else {
          setScheduleConflicts([]);
          setScheduleLoad({});
        }
      } finally {
        setConflictsLoading(false);
      }
    };

    loadConflicts();
  }, [endDate, endTime, reusableItems, startDate, startTime, user?.id, visibleCatalog]);

  const conflictsByResource = useMemo(() => {
    return scheduleConflicts.reduce<Record<string, ScheduleConflict[]>>((acc, item) => {
      if (!acc[item.resource_id]) acc[item.resource_id] = [];
      acc[item.resource_id].push(item);
      return acc;
    }, {});
  }, [scheduleConflicts]);

  const handleUpdateQuantity = (id: string, delta: number) => {
    setRequestItems(requestItems.map(item => {
      if (item.resourceId === id) {
        const newQuantity = Math.max(1, Math.min(item.maxAvailable, item.quantity + delta));
        const next = { ...item, quantity: newQuantity };
        if (next.assignMode === 'pick' && (next.selectedUnitIds?.length ?? 0) !== newQuantity) {
          next.selectedUnitIds = [];
        }
        return next;
      }
      return item;
    }));
  };

  const setItemAssignMode = (resourceId: string, mode: 'auto' | 'pick') => {
    setRequestItems(requestItems.map(i =>
      i.resourceId === resourceId ? { ...i, assignMode: mode, selectedUnitIds: mode === 'pick' ? [] : undefined } : i
    ));
  };

  const toggleUnitSelection = (resourceId: string, unitId: string) => {
    setRequestItems(requestItems.map(item => {
      if (item.resourceId !== resourceId) return item;
      const current = item.selectedUnitIds ?? [];
      const has = current.includes(unitId);
      const next = has ? current.filter(id => id !== unitId) : current.length < item.quantity ? [...current, unitId] : current;
      return { ...item, selectedUnitIds: next };
    }));
  };

  const handleRemoveItem = (id: string) => {
    setRequestItems(requestItems.filter(item => item.resourceId !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestItems.length === 0 || !user || (hasReusableItems && (!startDate || !endDate))) {
      setError('Completa al menos las fechas y selecciona recursos');
      return;
    }
    const pickIncomplete = requestItems.find(
      (i) => i.resourceType !== 'consumable' && i.quantity > 1 && i.assignMode === 'pick' && (i.selectedUnitIds?.length ?? 0) !== i.quantity
    );
    if (pickIncomplete) {
      setError(`Para "${pickIncomplete.name}" debes elegir exactamente ${pickIncomplete.quantity} unidades por nº de serie, o cambiar a "Asignar según series disponibles".`);
      return;
    }
    if (hasReusableItems && scheduleConflicts.length > 0) {
      const firstConflict = scheduleConflicts[0];
      const resourceName = reusableItems.find((item) => item.resourceId === firstConflict.resource_id)?.name || 'el recurso seleccionado';
      setError(`Ya existe una reserva aprobada o pendiente para "${resourceName}" en ese bloque horario. Ajusta la fecha u hora antes de enviar.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      if (saveTemplate) {
        localStorage.setItem('requestTemplate', JSON.stringify({
          useLocation,
          startTime,
          endTime,
          reason
        }));
      }

      // Get user profile for organization_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('No se encontró la organización del usuario');

      const consumableItems = requestItems.filter((item) => item.resourceType === 'consumable' && !item.procurementOnly);
      const procurementItems = requestItems.filter((item) => item.procurementOnly);
      if (consumableItems.length > 0) {
        for (const item of consumableItems) {
          const resource = resources.find((entry) => entry.id === item.resourceId);
          const currentStock = Number(resource?.available_quantity ?? resource?.initial_quantity ?? 0);
          if (currentStock < item.quantity) {
            throw new Error(`No hay stock suficiente para "${item.name}".`);
          }

          const { error: stockError } = await supabase
            .from('resources')
            .update({
              initial_quantity: currentStock - item.quantity,
              status: currentStock - item.quantity > 0 ? 'available' : 'on_loan',
            })
            .eq('id', item.resourceId);

          if (stockError) throw stockError;
        }

        try {
          await supabase.from('activity_logs').insert(
            consumableItems.map((item) => ({
              action: 'consumable_checkout',
              entity_type: 'resource',
              entity_id: item.resourceId,
              user_id: user.id,
              details: {
                message: `${user?.user_metadata?.full_name || 'Usuario'} retiró ${item.quantity} de "${item.name}"`,
                resource_name: item.name,
                quantity: item.quantity,
                actor_name: user?.user_metadata?.full_name,
                use_location: useLocation || null,
                notes: reason || null,
                checked_out_at: new Date().toISOString(),
              },
            }))
          );
        } catch (_) {}
      }

      if (procurementItems.length > 0) {
        const purchaseRequests = procurementItems.map((item) => ({
          user_id: user.id,
          organization_id: profile.organization_id,
          resource_id: item.resourceId,
          quantity: Math.max(1, item.quantity),
          urgency: 'high',
            notes: `Solicitud de compra. Ubicación de uso: ${useLocation || 'No especificada'}. Motivo: ${reason || 'Sin detalle adicional'}`,
            status: 'pending',
            ...(startDate ? { needed_from: startDate } : {}),
            ...(endDate ? { needed_until: endDate } : {}),
            ...(startTime ? { start_time: startTime } : {}),
            ...(endTime ? { end_time: endTime } : {}),
          }));

        const { error: purchaseError } = await supabase.from('requests').insert(purchaseRequests);
        if (purchaseError) throw purchaseError;

        try {
          await supabase.from('activity_logs').insert(
            procurementItems.map((item) => ({
              action: 'purchase_requested',
              entity_type: 'request',
              entity_id: item.resourceId,
              user_id: user.id,
              details: {
                message: `Solicitud de compra creada para "${item.name}"`,
                resource_name: item.name,
                quantity: item.quantity,
                actor_name: user?.user_metadata?.full_name,
              },
            }))
          );
        } catch (_) {}
      }

      if (reusableItems.length > 0) {
        const requests = reusableItems.map(item => {
          const payload: Record<string, unknown> = {
            user_id: user.id,
            organization_id: profile.organization_id,
            resource_id: item.resourceId,
            quantity: Math.max(1, item.quantity),
            urgency: 'normal',
            notes: `Ubicación: ${useLocation || 'No especificada'}. Fechas: ${startDate} ${startTime} a ${endDate} ${endTime}. Motivo: ${reason}`,
            status: 'pending',
            ...(startDate ? { needed_from: startDate } : {}),
            ...(endDate ? { needed_until: endDate } : {}),
            ...(startTime ? { start_time: startTime } : {}),
            ...(endTime ? { end_time: endTime } : {}),
          };
          if (item.assignMode === 'pick' && item.selectedUnitIds?.length === item.quantity) {
            payload.requested_unit_ids = item.selectedUnitIds;
          }
          return payload;
        });

        let reqError = null;
        const insertWithTime = await supabase.from('requests').insert(requests);
        reqError = insertWithTime.error;
        if (reqError && String(reqError.message || '').toLowerCase().match(/start_time|end_time|column/)) {
          const fallbackRequests = requests.map(({ start_time: _startTime, end_time: _endTime, ...rest }) => rest);
          const fallbackInsert = await supabase.from('requests').insert(fallbackRequests);
          reqError = fallbackInsert.error;
        }

        if (reqError) throw reqError;

        try {
          await supabase.from('activity_logs').insert(
            reusableItems.map((item) => ({
              action: 'request_created',
              entity_type: 'request',
              entity_id: item.resourceId,
              user_id: user.id,
              details: {
                message: `Solicitud creada para "${item.name}"`,
                resource_name: item.name,
                actor_name: user?.user_metadata?.full_name
              }
            }))
          );
        } catch (_) {}
      }

      setIsSuccess(true);
      setRequestItems([]);
      setExpandedItems({});
      setStartDate('');
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setReason('');

      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#E8E8E6]">Solicitar Recursos</h1>
          <p className="text-sm text-gray-500 dark:text-[#787774] mt-1">
            Selecciona los recursos que necesitas y especifica las fechas de uso.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
              <Input
                placeholder="Buscar por nombre o categoría..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="secondary" className="bg-white dark:bg-[#242424]">
              <Filter className="w-4 h-4 mr-2" /> Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resourcesLoading ? (
              <div className="col-span-full py-20 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-200 dark:border-[#3A3A3A] border-t-gray-900 dark:border-t-[#E8E8E6] rounded-full animate-spin"></div>
              </div>
            ) : filteredCatalog.map((resource) => {
              const resourceScheduleConflicts = scheduleLoad[resource.id] ?? [];
              const approvedConflicts = resourceScheduleConflicts.filter((entry) => entry.status === 'approved').length;
              const pendingConflicts = resourceScheduleConflicts.filter((entry) => entry.status === 'pending').length;
              return (
              <Card key={resource.id} className="p-4 flex flex-col justify-between hover:border-gray-300 dark:hover:border-[#444] transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-[#1D1D1D] shrink-0 overflow-hidden flex items-center justify-center">
                        <img
                          src={resource.image_url || 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg'}
                          alt={resource.name}
                          className={cn("w-full h-full object-cover", !resource.image_url && "opacity-20 p-2 object-contain")}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg';
                            (e.target as HTMLImageElement).classList.add('opacity-20', 'p-2', 'object-contain');
                          }}
                        />
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-[#E8E8E6] line-clamp-2 text-sm max-w-[140px]">{resource.name}</h3>
                    </div>
                    <Badge variant="neutral" className="shrink-0">{resource.categories?.name || 'General'}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-[#787774] space-y-1 mt-1 mb-4">
                    <p>Propiedad: <span className="font-medium text-gray-700 dark:text-[#C8C8C6]">{resource.ownership_type || 'General'}</span></p>
                    {resource.type !== 'consumable' && (
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      Devolver en: <span className="font-medium text-gray-700 dark:text-[#C8C8C6]">{resource.locations?.name || 'No asignada'}</span>
                    </p>
                    )}
                    <p>Disponibles: <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">{resource.available_quantity ?? 0}</span></p>
                    <p>
                      {getDeliveryEstimate(resource).label}:{' '}
                      <span className={cn('font-medium', getDeliveryEstimate(resource).tone)}>{getDeliveryEstimate(resource).value}</span>
                    </p>
                    {resource.type !== 'consumable' && startDate && endDate && resourceScheduleConflicts.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        {approvedConflicts > 0 && <p>{approvedConflicts} reserva(s) aprobada(s) en esta franja.</p>}
                        {pendingConflicts > 0 && <p>{pendingConflicts} solicitud(es) pendiente(s) en esta franja.</p>}
                      </div>
                    )}
                    {(resource.available_quantity ?? 0) === 0 && resource.type !== 'consumable' && (
                      <p className="text-amber-600 dark:text-amber-400 text-[10px] font-medium mt-0.5">Sin unidades libres; se procesará cuando exista devolución o reasignación.</p>
                    )}
                  </div>
                </div>
                <Button
                  variant={requestItems.some(i => i.resourceId === resource.id) ? "soft" : "secondary"}
                  className={cn(
                    "w-full transition-colors font-medium border shadow-xs h-9 text-xs",
                    requestItems.some(i => i.resourceId === resource.id)
                      ? "bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      : "bg-white dark:bg-[#242424] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] border-gray-200 dark:border-[#3A3A3A]"
                  )}
                  onClick={() => handleAddItem(resource)}
                >
                  {requestItems.some(i => i.resourceId === resource.id) ? (
                    <>✨ Añadido ({requestItems.find(i => i.resourceId === resource.id)?.quantity})</>
                  ) : resource.type === 'consumable' && (resource.available_quantity ?? 0) <= 0 ? (
                    <><ShoppingCart className="w-4 h-4 mr-1" /> Solicitar compra</>
                  ) : (
                    <>➕ Añadir a solicitud</>
                  )}
                </Button>
              </Card>
            );})}
            {filteredCatalog.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500 dark:text-[#787774] bg-white dark:bg-[#242424] rounded-xl">
                No se encontraron recursos que coincidan con tu búsqueda.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Request Cart */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#242424] rounded-xl shadow-sm sticky top-6">
            <div className="p-4 bg-gray-50/50 dark:bg-[#1D1D1D] rounded-t-xl">
              <h2 className="font-semibold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2">
                <Package className="w-4 h-4" />
                Tu Solicitud
                {requestItems.length > 0 && !isSubmitting && !isSuccess && (
                  <span className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full ml-auto">
                    {requestItems.length}
                  </span>
                )}
              </h2>
            </div>

            {isSubmitting ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-gray-200 dark:border-[#3A3A3A] border-t-gray-900 dark:border-t-[#E8E8E6] rounded-full animate-spin" aria-hidden />
                <p className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Enviando solicitud...</p>
                <p className="text-xs text-gray-500 dark:text-[#787774]">Espera un momento</p>
              </div>
            ) : isSuccess ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Solicitud enviada</p>
                <p className="text-xs text-gray-500 dark:text-[#787774] text-center">Recibirás notificación cuando sea procesada.</p>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              {error && (
                <div className="p-3 rounded-md border border-error-200 dark:border-red-900/40 bg-error-50 dark:bg-red-950/20 text-error-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              {hasConsumableItems && !hasReusableItems && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400">
                  Estos recursos son consumibles: se registran como retiro directo y no requieren fecha de devolución.
                </div>
              )}
              {hasProcurementItems && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
                  Algunos consumibles no tienen stock. Se enviarán como solicitud de compra para que administración gestione el abastecimiento.
                </div>
              )}
              {hasConsumableItems && hasReusableItems && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400">
                  El envío será mixto: los consumibles se registran como retiro directo y los reutilizables se envían como solicitud con fechas.
                </div>
              )}
              {hasReusableItems && (conflictsLoading || scheduleConflicts.length > 0) && (
                <div className={cn(
                  'rounded-md px-3 py-2 text-sm',
                  scheduleConflicts.length > 0
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
                    : 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400'
                )}>
                  {conflictsLoading
                    ? 'Revisando agenda y posibles solapes horarios...'
                    : `Se detectaron ${scheduleConflicts.length} reserva(s) que chocan con el horario elegido. Ajusta la hora antes de enviar.`}
                </div>
              )}
              {/* Selected Items */}
              <div className="space-y-3">
                {requestItems.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 dark:text-[#787774] rounded-lg">
                    No has seleccionado ningún recurso aún.
                  </div>
                ) : (
                  requestItems.map((item) => {
                    const units = availableUnitsByResource[item.resourceId] ?? [];
                    const exampleSerials = units.slice(0, item.quantity).map((u) => u.serial_number || u.id.slice(0, 8)).filter(Boolean);
                    const assignMode = item.assignMode ?? 'auto';
                    const selectedIds = item.selectedUnitIds ?? [];
                    const canSubmitPick = assignMode === 'pick' && selectedIds.length === item.quantity;
                    const isExpanded = expandedItems[item.resourceId] ?? false;
                    const resourceMeta = resources.find((resource) => resource.id === item.resourceId);
                    const deliveryEstimate = resourceMeta ? getDeliveryEstimate(resourceMeta) : null;
                    const resourceConflicts = conflictsByResource[item.resourceId] ?? [];
                    return (
                    <div key={item.resourceId} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-[#1D1D1D] rounded-lg">
                      <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6] truncate" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#787774]">Máx: {item.maxAvailable}</p>
                        {deliveryEstimate && (
                          <p className="text-xs mt-1">
                            <span className="text-gray-500 dark:text-[#787774]">{deliveryEstimate.label}: </span>
                            <span className={deliveryEstimate.tone}>{deliveryEstimate.value}</span>
                          </p>
                        )}
                        {item.locationName && item.resourceType !== 'consumable' && (
                          <p className="text-xs text-gray-600 dark:text-[#AAAAAA] mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            Devolver en: {item.locationName}
                          </p>
                        )}
                        {!item.locationName && item.resourceType !== 'consumable' && (
                          <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            Devolver en: No asignada
                          </p>
                        )}
                        {item.resourceType === 'consumable' && (
                          <p className={cn("text-xs mt-0.5", item.procurementOnly ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400")}>
                            {item.procurementOnly ? 'Se enviará como solicitud de compra.' : 'Retiro directo de stock. No requiere devolución.'}
                          </p>
                        )}
                        {item.resourceType !== 'consumable' && startDate && (
                          <p className="text-xs mt-0.5 text-gray-500 dark:text-[#787774]">
                            Ventana elegida: {startDate === endDate || !endDate ? startDate : `${startDate} a ${endDate}`} · {formatTimeRange(startTime, endTime)}
                          </p>
                        )}
                        {resourceConflicts.length > 0 && (
                          <p className="text-xs mt-1 text-rose-600 dark:text-rose-300">
                            {resourceConflicts.length} choque(s) detectado(s) con reservas {resourceConflicts.some((entry) => entry.status === 'approved') ? 'aprobadas' : 'pendientes'}.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3A3A3A] rounded-md">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.resourceId, -1)}
                            className="p-1 text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] rounded-l-md transition-colors"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.maxAvailable}
                            value={item.quantity}
                            onChange={(e) => {
                              let val = parseInt(e.target.value);
                              if (isNaN(val) || val < 1) val = 1;
                              if (val > item.maxAvailable) val = item.maxAvailable;
                              setRequestItems(requestItems.map(i => i.resourceId === item.resourceId ? { ...i, quantity: val } : i));
                            }}
                            className="w-10 text-center text-sm font-medium text-gray-900 dark:text-[#E8E8E6] border-none focus:ring-0 p-0 bg-transparent h-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.resourceId, 1)}
                            className="p-1 text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] rounded-r-md transition-colors"
                            disabled={item.quantity >= item.maxAvailable}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.resourceId)}
                          className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleItemExpanded(item.resourceId)}
                          className="p-1.5 text-gray-500 dark:text-[#787774] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-md transition-colors"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      </div>
                      </div>
                      {isExpanded && (
                        <>
                      {item.quantity > 1 && item.resourceType !== 'consumable' && (
                        <div className="text-xs text-gray-600 dark:text-[#AAAAAA] pt-2 mt-1 space-y-2">
                          <p className="font-medium text-gray-700 dark:text-[#C8C8C6]">Solicitas {item.quantity} unidades.</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setItemAssignMode(item.resourceId, 'auto')}
                              className={cn(
                                'px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors',
                                assignMode === 'auto'
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                              )}
                            >
                              Asignar según series disponibles
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemAssignMode(item.resourceId, 'pick')}
                              className={cn(
                                'px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors',
                                assignMode === 'pick'
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                              )}
                            >
                              Elegir unidades por nº de serie
                            </button>
                          </div>
                          {assignMode === 'auto' && (
                            <p className="text-gray-500 dark:text-[#787774]">
                              {exampleSerials.length > 0
                                ? `Al aprobar se asignarán por orden, ej.: ${exampleSerials.join(', ')}${units.length > item.quantity ? ` (+${units.length - item.quantity} más disponibles)` : ''}`
                                : 'Al aprobar se asignarán unidades disponibles (por nº de serie).'}
                            </p>
                          )}
                          {assignMode === 'pick' && (
                            <div className="space-y-1.5">
                              <p className="text-gray-500 dark:text-[#787774]">
                                Elige {item.quantity} unidad(es): {selectedIds.length}/{item.quantity}
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {units.map((u) => {
                                  const sid = u.serial_number || u.id.slice(0, 8);
                                  const checked = selectedIds.includes(u.id);
                                  return (
                                    <label
                                      key={u.id}
                                      className={cn(
                                        'inline-flex items-center gap-1 px-2 py-1 rounded border cursor-pointer text-xs transition-colors',
                                        checked
                                          ? 'bg-gray-900 text-white border-gray-900'
                                          : 'bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] text-gray-700 dark:text-[#C8C8C6] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleUnitSelection(item.resourceId, u.id)}
                                        className="sr-only"
                                      />
                                      {sid}
                                    </label>
                                  );
                                })}
                              </div>
                              {!canSubmitPick && assignMode === 'pick' && selectedIds.length > 0 && (
                                <p className="text-amber-600 dark:text-amber-400 text-[10px]">Selecciona exactamente {item.quantity} unidades para enviar.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {item.resourceType === 'consumable' && !item.procurementOnly && (
                        <div className="rounded-md bg-white/70 dark:bg-[#242424] px-3 py-2 text-xs text-gray-600 dark:text-[#AAAAAA]">
                          Se registrará a tu nombre y quedará visible para administración en el dashboard e historial del recurso.
                        </div>
                      )}
                      {resourceConflicts.length > 0 && (
                        <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
                          {resourceConflicts.slice(0, 3).map((conflict) => (
                            <div key={conflict.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{conflict.status === 'approved' ? 'Aprobada' : 'Pendiente'}</span>
                              <span>
                                {toIsoDate(conflict.needed_from) === toIsoDate(conflict.needed_until)
                                  ? toIsoDate(conflict.needed_from)
                                  : `${toIsoDate(conflict.needed_from)} a ${toIsoDate(conflict.needed_until)}`}
                              </span>
                              <span>{formatAgendaTimeLabel(conflict.start_time, conflict.end_time)}</span>
                              <span className="text-rose-500/80 dark:text-rose-200/80">
                                · {(Array.isArray(conflict.profiles) ? conflict.profiles[0]?.full_name : conflict.profiles?.full_name) || 'Otro usuario'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  ); })
                )}
              </div>

              {/* Request Details */}
              <div className="space-y-4 pt-4">
                <button
                  type="button"
                  onClick={() => setRequestDetailsCollapsed((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-[#1D1D1D] dark:text-[#C8C8C6] dark:hover:bg-[#242424]"
                >
                  <span>Detalles de entrega y uso</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", !requestDetailsCollapsed && "rotate-180")} />
                </button>

                {!requestDetailsCollapsed && (
                  <>
                {hasReusableItems && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setStartDate(today);
                        setEndDate(today);
                    }}
                    className="text-xs font-semibold text-gray-700 dark:text-[#C8C8C6] hover:text-gray-900 dark:hover:text-[#E8E8E6] hover:bg-gray-100 dark:hover:bg-[#333] bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#3A3A3A] shadow-xs px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5"
                  >
                    🎯 Establecer Fecha "Hoy"
                  </button>
                </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">
                      {hasReusableItems ? 'Fecha de inicio *' : 'Fecha de retiro'}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
                        <Input
                          type="date"
                          className="pl-8 text-sm h-9"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required={hasReusableItems}
                        />
                      </div>
                      <div className="relative w-28">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
                        <Input
                          type="time"
                          className="pl-8 text-sm h-9"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                    </div>
                    {hasReusableItems && (
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-[#787774]">
                        La hora estimada se usará para detectar solapes y para mostrar la agenda operativa.
                      </p>
                    )}
                  </div>
                  {hasReusableItems && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Fecha de fin *</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
                        <Input
                          type="date"
                          className="pl-8 text-sm h-9"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="relative w-28">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
                        <Input
                          type="time"
                          className="pl-8 text-sm h-9"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Lugar de Uso</label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#555]" />
                      <Input
                        placeholder="📍 Ej. Salón 301, Auditorio..."
                        className="pl-8 text-sm h-9"
                        value={useLocation}
                        onChange={(e) => setUseLocation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Motivo / Proyecto</label>
                  <textarea
                    className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow min-h-[80px] resize-y placeholder:text-gray-400 dark:placeholder:text-[#555]"
                    placeholder="📝 Ej. Clase de ciencias de 3er grado..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 pb-1">
                  <input
                    type="checkbox"
                    id="saveTemplate"
                    className="rounded border-gray-300 dark:border-[#444] text-gray-900 focus:ring-gray-900"
                    checked={saveTemplate}
                    onChange={(e) => setSaveTemplate(e.target.checked)}
                  />
                  <label htmlFor="saveTemplate" className="text-sm text-gray-700 dark:text-[#C8C8C6] flex items-center gap-1.5 cursor-pointer">
                    <Save className="w-4 h-4 text-gray-400 dark:text-[#555]" />
                    Guardar como preferido para usos recurrentes
                  </label>
                </div>
                  </>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gray-900 text-white hover:bg-gray-800 shadow-md font-medium"
                  disabled={requestItems.length === 0}
                >
                  {hasConsumableItems && !hasReusableItems ? 'Registrar retiro' : hasConsumableItems && hasReusableItems ? 'Procesar retiro y solicitud' : 'Enviar Solicitud'}
                </Button>
              </div>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RequestResource() {
  return <Suspense><RequestResourceInner /></Suspense>
}
