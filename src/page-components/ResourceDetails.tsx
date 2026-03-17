'use client'
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Printer, CheckCircle2, ArrowRight, AlertCircle, Layers, Building2, Laptop, Palette, FlaskConical, Ruler, ScanLine, Plus, Trash2, X, CalendarDays, Clock3, History, Upload, FileText, BarChart3, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useResource, useConditionTags, useIsDepartmentLeader } from '@/lib/hooks';
import { TAG_COLORS, TAG_COLOR_KEYS } from '@/lib/conditionTags';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { getCatalogVisibility } from '@/lib/resourceVisibility';
import { compareIsoDate, formatAgendaTimeLabel, toIsoDate } from '@/lib/scheduling';
import { uploadResourceImage } from '@/lib/storage';

const CAT_ICONS: Record<string, any> = {
  'Tecnología': Laptop,
  'Arte': Palette,
  'Laboratorio': FlaskConical,
  'Material Escolar': Ruler,
  'Mobiliario': Building2,
  'Oficina': Layers,
  'Herramientas': Layers
};

type BarcodeRow = { code: string; resource_id: string | null; unit_id: string | null };
type ResourceFileEntry = {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
  mime_type?: string | null;
  uploaded_by?: string | null;
};

export function ResourceDetails() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('inventory');
  const { resource, units, loading, error, refetchResource } = useResource(id);
  const { role } = useRole();
  const { user } = useAuth();
  const isDeptManager = useIsDepartmentLeader(user?.id);
  const canEditCondition = role === 'admin' || role === 'approver' || isDeptManager;
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([]);
  const [barcodesLoading, setBarcodesLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newCodeUnitId, setNewCodeUnitId] = useState<string>('');
  const [addingCode, setAddingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOption, setPrintOption] = useState<'resource' | 'per_unit' | 'all_codes'>('per_unit');
  const [addUnitsModalOpen, setAddUnitsModalOpen] = useState(false);
  const [unitsToAdd, setUnitsToAdd] = useState('1');
  const [unitPrefix, setUnitPrefix] = useState('');
  const [unitStartNumber, setUnitStartNumber] = useState('');
  const [addUnitsError, setAddUnitsError] = useState<string | null>(null);
  const [addingUnits, setAddingUnits] = useState(false);
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('0');
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  // Condition tag editor state
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  const [localTagIds, setLocalTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('gray');
  const [creatingTag, setCreatingTag] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const { tags: orgTags, refetch: refetchOrgTags } = useConditionTags();

  // Sync local tag ids and notes draft when resource loads
  useEffect(() => {
    if (!resource) return;
    setLocalTagIds(
      (resource.resource_condition_tags || [])
        .map((rct: any) => rct.condition_tags?.id)
        .filter(Boolean)
    );
    setNotesDraft(resource.condition_notes || '');
  }, [resource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [resourceActivity, setResourceActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [resourceFiles, setResourceFiles] = useState<ResourceFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fetchBarcodes = useCallback(async () => {
    if (!id) return;
    setBarcodesLoading(true);
    try {
      const unitIds = units.map((u: { id: string }) => u.id);
      const orParts = [`resource_id.eq.${id}`];
      if (unitIds.length > 0) orParts.push(`unit_id.in.(${unitIds.join(',')})`);
      const { data, error: err } = await supabase
        .from('barcodes')
        .select('code, resource_id, unit_id')
        .or(orParts.join(','));
      if (!err) setBarcodes(data ?? []);
    } finally {
      setBarcodesLoading(false);
    }
  }, [id, units]);

  useEffect(() => {
    if (id && units) fetchBarcodes();
  }, [id, units, fetchBarcodes]);

  useEffect(() => {
    const fetchResourceActivity = async () => {
      if (!id) return;
      setActivityLoading(true);
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*, profiles(full_name)')
          .eq('entity_id', id)
          .in('action', ['stock_allocated', 'consumable_checkout'])
          .order('created_at', { ascending: false })
          .limit(8);
        setResourceActivity(data ?? []);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchResourceActivity();
  }, [id, resource?.available_quantity]);

  useEffect(() => {
    const fetchScheduleEntries = async () => {
      if (!id) return;
      setScheduleLoading(true);
      try {
        const { data } = await supabase
          .from('requests')
          .select('id, status, quantity, needed_from, needed_until, start_time, end_time, profiles(full_name)')
          .eq('resource_id', id)
          .in('status', ['pending', 'approved'])
          .order('needed_from', { ascending: true })
          .limit(6);
        setScheduleEntries(data ?? []);
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchScheduleEntries();
  }, [id]);

  useEffect(() => {
    const fetchResourceFiles = async () => {
      if (!id) return;
      setFilesLoading(true);
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('id, created_at, user_id, details')
          .eq('entity_type', 'resource')
          .eq('entity_id', id)
          .eq('action', 'resource_file_uploaded')
          .order('created_at', { ascending: false });
        setResourceFiles(
          (data ?? []).map((entry: any) => ({
            id: entry.id,
            name: entry.details?.file_name || 'Archivo',
            url: entry.details?.file_url || '#',
            uploaded_at: entry.created_at,
            mime_type: entry.details?.mime_type || null,
            uploaded_by: entry.details?.actor_name || null,
          }))
        );
      } finally {
        setFilesLoading(false);
      }
    };

    fetchResourceFiles();
  }, [id]);

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code || !id) return;
    setCodeError(null);
    setAddingCode(true);
    try {
      const payload: { code: string; resource_id: string; unit_id?: string } = {
        code,
        resource_id: id,
      };
      if (newCodeUnitId) payload.unit_id = newCodeUnitId;
      const { error: err } = await supabase.from('barcodes').insert(payload);
      if (err) throw err;
      setNewCode('');
      setNewCodeUnitId('');
      fetchBarcodes();
    } catch (e: unknown) {
      setCodeError(e instanceof Error ? e.message : 'No se pudo guardar el código. ¿Está duplicado?');
    } finally {
      setAddingCode(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    setDeletingCode(code);
    try {
      const { error: err } = await supabase.from('barcodes').delete().eq('code', code);
      if (err) throw err;
      fetchBarcodes();
    } catch {
      setCodeError('No se pudo eliminar el código');
    } finally {
      setDeletingCode(null);
    }
  };

  const qrUrl = (code: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(code)}`;

  const labelsToPrint = (): { title: string; code: string }[] => {
    const name = resource?.name ?? '';
    const sku = resource?.sku ?? '';
    if (printOption === 'resource')
      return [{ title: name, code: sku }];
    if (printOption === 'per_unit' && isReusable && units.length > 0)
      return units.map((u: { serial_number?: string; id: string }) => ({
        title: name,
        code: (u as { serial_number?: string }).serial_number ?? sku,
      }));
    if (printOption === 'all_codes') {
      const list: { title: string; code: string }[] = [{ title: name, code: sku }];
      barcodes.forEach((row) => {
        if (!list.some((l) => l.code === row.code)) list.push({ title: name, code: row.code });
      });
      return list;
    }
    return [{ title: name, code: sku }];
  };

  const printSingleLabel = () => {
    const name = resource?.name ?? '';
    const sku = resource?.sku ?? '';
    const labelsHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }
        .label { width: 280px; border: 2px solid #111; padding: 12px; text-align: center; }
        .label h2 { margin: 0 0 8px; font-size: 14px; }
        .label .code { font-family: monospace; font-size: 12px; letter-spacing: 0.1em; }
        .label img { display: block; margin: 8px auto 0; }
      </style></head><body>
      <div class="label">
        <h2>${name}</h2>
        <div class="code">${sku}</div>
        <img src="${qrUrl(sku)}" width="100" height="100" alt="" />
      </div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(labelsHtml);
      w.document.close();
      w.onload = () => {
        w.focus();
        w.print();
        w.close();
      };
    }
  };

  const printBulkLabels = () => {
    const list = labelsToPrint();
    const labelsHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas - ${resource?.name ?? ''}</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 600px; }
        @media print { .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
        .label { border: 2px solid #111; padding: 10px; text-align: center; break-inside: avoid; }
        .label h2 { margin: 0 0 6px; font-size: 13px; }
        .label .code { font-family: monospace; font-size: 11px; letter-spacing: 0.05em; }
        .label img { display: block; margin: 6px auto 0; }
      </style></head><body>
      <div class="grid">
        ${list
          .map(
            (l) => `
        <div class="label">
          <h2>${l.title}</h2>
          <div class="code">${l.code}</div>
          <img src="${qrUrl(l.code)}" width="100" height="100" alt="" />
        </div>`
          )
          .join('')}
      </div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(labelsHtml);
      w.document.close();
      w.onload = () => {
        w.focus();
        w.print();
        w.close();
      };
    }
    setPrintModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-[#3A3A3A] border-t-gray-900 dark:border-t-[#E8E8E6] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="text-center p-20">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Error al cargar recurso</h2>
        <p className="text-gray-500 dark:text-[#787774] mt-2">{error?.message || 'Recurso no encontrado'}</p>
        <Link href="/recursos" className="inline-block mt-4 text-blue-600 hover:underline">Volver a recursos</Link>
      </div>
    );
  }

  const Icon = CAT_ICONS[resource.categories?.name] || Layers;
  const isReusable = resource.type === 'reusable';
  const nextUnitNumber = units.reduce((max, unit) => {
    const match = unit.serial_number?.match(/(\d+)$/);
    const numeric = match ? Number(match[1]) : 0;
    return Math.max(max, numeric);
  }, 0) + 1;
  const defaultUnitPrefix = resource.sku.split('-')[0] || 'ITM';
  const unitUsageHistory = units
    .flatMap((unit) =>
      (unit.loans ?? []).map((loan: any) => ({
        id: loan.id,
        serial_number: unit.serial_number,
        full_name: loan.profiles?.full_name,
        status: loan.status,
        due_date: loan.due_date,
        return_date: loan.return_date,
        end_time: loan.requests?.end_time,
        needed_until: loan.requests?.needed_until,
      }))
    )
    .sort((a, b) => {
      const left = b.return_date || b.due_date || '';
      const right = a.return_date || a.due_date || '';
      return left.localeCompare(right);
    });
  const upcomingSchedule = scheduleEntries
    .map((entry) => ({
      ...entry,
      startDate: toIsoDate(entry.needed_from),
      endDate: toIsoDate(entry.needed_until ?? entry.needed_from),
    }))
    .filter((entry) => entry.startDate && compareIsoDate(entry.endDate, new Date().toISOString().split('T')[0]) >= 0);
  const nextScheduleEntry = upcomingSchedule[0];

  const openAddUnitsModal = () => {
    setUnitsToAdd('1');
    setUnitPrefix(defaultUnitPrefix);
    setUnitStartNumber(String(nextUnitNumber));
    setAddUnitsError(null);
    setAddUnitsModalOpen(true);
  };

  const openAdjustStockModal = () => {
    setStockQuantity(String(resource.initial_quantity ?? resource.available_quantity ?? 0));
    setStockError(null);
    setAdjustStockModalOpen(true);
  };

  const handleAddUnits = async () => {
    if (!id || !resource) return;
    const quantity = Number.parseInt(unitsToAdd, 10);
    const startNumber = Number.parseInt(unitStartNumber, 10);
    const prefix = unitPrefix.trim().toUpperCase() || defaultUnitPrefix;

    if (!Number.isFinite(quantity) || quantity < 1) {
      setAddUnitsError('Indica una cantidad válida de unidades.');
      return;
    }
    if (!Number.isFinite(startNumber) || startNumber < 1) {
      setAddUnitsError('Indica un número inicial válido.');
      return;
    }

    setAddUnitsError(null);
    setAddingUnits(true);
    try {
      const generatedUnits = Array.from({ length: quantity }).map((_, index) => ({
        resource_id: id,
        organization_id: resource.organization_id,
        serial_number: `${prefix}-${(startNumber + index).toString().padStart(3, '0')}`,
        status: 'available',
        condition: 'new',
      }));

      const { error: insertError } = await supabase.from('resource_units').insert(generatedUnits);
      if (insertError) throw insertError;

      const targetQuantity = Math.max(
        resource.initial_quantity ?? 0,
        units.length + quantity
      );
      await supabase
        .from('resources')
        .update({ initial_quantity: targetQuantity })
        .eq('id', id);

      setAddUnitsModalOpen(false);
      refetchResource?.();
    } catch (err) {
      setAddUnitsError(err instanceof Error ? err.message : 'No se pudieron añadir las unidades.');
    } finally {
      setAddingUnits(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!id) return;
    const quantity = Number.parseInt(stockQuantity, 10);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setStockError('Indica una cantidad válida para el stock.');
      return;
    }

    setStockError(null);
    setAdjustingStock(true);
    try {
      const nextStatus = quantity > 0 ? 'available' : 'on_loan';
      const { error: updateError } = await supabase
        .from('resources')
        .update({ initial_quantity: quantity, status: nextStatus })
        .eq('id', id);
      if (updateError) throw updateError;
      setAdjustStockModalOpen(false);
      refetchResource?.();
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'No se pudo actualizar el stock.');
    } finally {
      setAdjustingStock(false);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    const isSelected = localTagIds.includes(tagId);
    setLocalTagIds((prev) => isSelected ? prev.filter((i) => i !== tagId) : [...prev, tagId]);
    if (isSelected) {
      await supabase.from('resource_condition_tags').delete().eq('resource_id', id).eq('tag_id', tagId);
    } else {
      await supabase.from('resource_condition_tags').insert({ resource_id: id, tag_id: tagId });
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !resource) return;
    setCreatingTag(true);
    try {
      const { data: newTag, error } = await supabase
        .from('condition_tags')
        .insert({ name: newTagName.trim(), color: newTagColor, organization_id: resource.organization_id })
        .select('id, name, color')
        .single();
      if (error) throw error;
      await supabase.from('resource_condition_tags').insert({ resource_id: id, tag_id: newTag.id });
      refetchOrgTags();
      setLocalTagIds((prev) => [...prev, newTag.id]);
      setNewTagName('');
      setNewTagColor('gray');
      setShowCreateForm(false);
    } catch (err) {
      toast.error('No se pudo crear la etiqueta');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    await supabase.from('resources').update({ condition_notes: notesDraft.trim() || null }).eq('id', id);
    setSavingNotes(false);
    toast.success('Nota guardada');
  };

  const handleMakePublic = async () => {
    if (!id || getCatalogVisibility(resource) === 'public') return;
    setVisibilityLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('resources')
        .update({ catalog_visibility: 'public' })
        .eq('id', id);
      if (updateError) throw updateError;
      refetchResource?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar la visibilidad del recurso.');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id || !resource?.organization_id) return;
    setFileError(null);
    setUploadingFile(true);
    try {
      const fileUrl = await uploadResourceImage(file, resource.organization_id, `${id}/docs`);
      await supabase.from('activity_logs').insert({
        action: 'resource_file_uploaded',
        entity_type: 'resource',
        entity_id: id,
        user_id: null,
        details: {
          file_name: file.name,
          file_url: fileUrl,
          mime_type: file.type,
          actor_name: 'Sistema',
        },
      });
      setResourceFiles((prev) => [
        {
          id: `${Date.now()}`,
          name: file.name,
          url: fileUrl,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
          uploaded_by: 'Sistema',
        },
        ...prev,
      ]);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Top Navigation / Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div className="flex items-center text-sm text-gray-500 dark:text-[#787774]">
          <Link href="/recursos" className="hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors">Recursos</Link>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-gray-900 dark:text-[#E8E8E6] font-medium">Detalles del recurso</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A] shadow-sm"
            onClick={handleMakePublic}
            disabled={getCatalogVisibility(resource) === 'public' || visibilityLoading}
          >
            {getCatalogVisibility(resource) !== 'public'
              ? visibilityLoading ? 'Publicando...' : 'Hacer público'
              : 'Visible en catálogo'}
          </Button>
          <Button
            variant="primary"
            className="bg-black text-white hover:bg-gray-800 shadow-md"
            onClick={() => router.push(`/solicitar?resource=${id}`)}
          >
            Solicitar Préstamo
          </Button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start gap-8 bg-gray-50/30 dark:bg-[#1D1D1D]">
          <div className="space-y-4 flex-1">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-[#E8E8E6] tracking-tight">{resource.name}</h1>
                {!resource.requires_approval && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 uppercase tracking-wider">
                    Auto-Aprobación
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-gray-500 dark:text-[#787774] mt-2 bg-white dark:bg-[#242424] px-3 py-1 rounded-md inline-block shadow-sm">
                #{resource.sku} • {isReusable ? `Lote de ${resource.total_quantity || resource.initial_quantity} unidades` : 'Recurso Consumible'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white dark:bg-[#242424] p-3 rounded-xl shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#555] font-bold block mb-1">Disponibilidad</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900 dark:text-[#E8E8E6]">{resource.available_quantity || 0}</span>
                  {isReusable ? (
                    <>
                      <span className="text-gray-400 dark:text-[#555]">/</span>
                      <span className="text-sm font-medium text-gray-600 dark:text-[#AAAAAA]">{resource.total_quantity || resource.initial_quantity} Disponibles</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-gray-600 dark:text-[#AAAAAA]">en stock</span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-[#242424] p-3 rounded-xl shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#555] font-bold block mb-1">Valor Unitario</span>
                <span className="text-xl font-bold text-gray-900 dark:text-[#E8E8E6]">{resource.cost_unit ? `$${resource.cost_unit.toLocaleString()}` : 'N/A'}</span>
              </div>

              <div className="bg-white dark:bg-[#242424] p-3 rounded-xl shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#555] font-bold block mb-1">Próxima agenda</span>
                {scheduleLoading ? (
                  <span className="text-sm font-medium text-gray-500 dark:text-[#787774]">Cargando agenda...</span>
                ) : nextScheduleEntry ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                      <CalendarDays className="w-4 h-4 text-gray-400 dark:text-[#787774]" />
                      <span>{nextScheduleEntry.startDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#787774]">
                      <Clock3 className="w-3.5 h-3.5" />
                      <span>{formatAgendaTimeLabel(nextScheduleEntry.start_time, nextScheduleEntry.end_time)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Sin horario reservado</span>
                )}
              </div>
            </div>
          </div>

          {/* Barcode Section */}
          <div className="bg-white dark:bg-[#242424] p-5 rounded-2xl flex flex-col items-center gap-4 min-w-[220px] shadow-sm">
            <div className="flex justify-between w-full items-start">
              <div className="w-full h-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwaDJ2NDAiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNNCAwaDF2NDAiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNNiAwaDV2NDAiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMTIgMGgxdjQwIiBmaWxsPSIjMDAwIi8+PHBhdGggZD0iTTE0IDBoM3Y0MCIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==')] bg-repeat-x bg-contain opacity-80" />
              <button
                type="button"
                onClick={printSingleLabel}
                className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors ml-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#333]"
                title="Imprimir etiqueta de este recurso"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[10px] font-mono font-bold text-gray-900 dark:text-[#E8E8E6] tracking-[0.2em]">{resource.sku}-MASTER</span>
          </div>
        </div>

        {/* Tabs & Content Area */}
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex gap-8 overflow-x-auto scrollbar-hide">
              {['Description', 'Inventory', 'Codes', 'Files', 'Insights'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`pb-4 text-sm font-semibold transition-all relative whitespace-nowrap ${
                    activeTab === tab.toLowerCase()
                      ? 'text-gray-900 dark:text-[#E8E8E6]'
                      : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#AAAAAA]'
                  }`}
                >
                  {tab === 'Description' ? 'Información' : tab === 'Inventory' ? 'Inventario / Unidades' : tab === 'Codes' ? 'Códigos para escanear' : tab}
                  {activeTab === tab.toLowerCase() && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-[#E8E8E6] rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mb-2 bg-gray-50 dark:bg-[#1D1D1D] border-gray-200 dark:border-[#3A3A3A] text-gray-600 dark:text-[#AAAAAA] font-bold h-8 px-4"
              onClick={() => router.push(`/recursos/nuevo?id=${id}`)}
            >
              Editar
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Column: Dynamic Content based on Tab */}
            <div className="lg:col-span-2">
              {activeTab === 'description' && (
                <div className="space-y-8">
                  <div className="prose prose-sm max-w-none">
                    <h3 className="text-gray-900 dark:text-[#E8E8E6] font-bold mb-3">Descripción General</h3>
                    <p className="text-gray-600 dark:text-[#AAAAAA] leading-relaxed text-base">
                      {resource.description || 'No hay descripción disponible para este recurso.'}
                    </p>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1D1D1D] flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#242424] shadow-xs flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-900 dark:text-[#E8E8E6]" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-[#555] block tracking-wider">Categoría</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.categories?.name || 'General'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1D1D1D] flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#242424] shadow-xs flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-900 dark:text-[#E8E8E6]" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-[#555] block tracking-wider">Ubicación</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.locations?.name || 'Sede Principal'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Condition tag editor — Notion-style */}
                  <div className="rounded-xl bg-gray-50 dark:bg-[#1D1D1D] overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-3">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-[#555] tracking-wider">Estado de condición</span>
                      {canEditCondition && (
                        <button
                          type="button"
                          onClick={() => { setIsConditionOpen((o) => !o); setTagSearch(''); setShowCreateForm(false); }}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {isConditionOpen ? 'Hecho' : 'Editar'}
                        </button>
                      )}
                    </div>

                    {/* Current tags display */}
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5 min-h-[28px]">
                      {localTagIds.length === 0 ? (
                        <span className="text-xs text-gray-400 dark:text-[#555]">Sin etiquetas</span>
                      ) : (
                        orgTags
                          .filter((t) => localTagIds.includes(t.id))
                          .map((tag) => {
                            const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                            return (
                              <span
                                key={tag.id}
                                className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', c.bg, c.text)}
                              >
                                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)} />
                                {tag.name}
                                {isConditionOpen && canEditCondition && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTag(tag.id)}
                                    className="ml-0.5 opacity-60 hover:opacity-100 transition"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            );
                          })
                      )}
                    </div>

                    {/* Editor panel (expanded when isConditionOpen) */}
                    {isConditionOpen && (
                      <div className="border-t border-black/[0.05] dark:border-white/[0.05] bg-white dark:bg-[#242424]">
                        {/* Search */}
                        <div className="px-4 pt-3 pb-2">
                          <input
                            type="text"
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            placeholder="Buscar etiquetas…"
                            className="w-full rounded-lg bg-gray-50 dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] px-3 py-1.5 text-xs text-gray-900 dark:text-[#E8E8E6] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Tag list */}
                        <div className="max-h-44 overflow-y-auto px-2 pb-1">
                          {orgTags
                            .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                            .map((tag) => {
                              const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                              const isSelected = localTagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => handleToggleTag(tag.id)}
                                  className={cn(
                                    'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition',
                                    isSelected
                                      ? 'bg-gray-50 dark:bg-[#1D1D1D]'
                                      : 'hover:bg-gray-50 dark:hover:bg-[#1D1D1D]'
                                  )}
                                >
                                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium flex-1', c.bg, c.text)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)} />
                                    {tag.name}
                                  </span>
                                  {isSelected && (
                                    <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          {orgTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                            <p className="px-2 py-3 text-xs text-gray-400 dark:text-[#555] text-center">Sin resultados</p>
                          )}
                        </div>

                        {/* Create new tag */}
                        <div className="border-t border-gray-100 dark:border-[#2A2A2A] px-4 py-3">
                          {!showCreateForm ? (
                            <button
                              type="button"
                              onClick={() => { setShowCreateForm(true); setNewTagName(tagSearch); }}
                              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#787774] hover:text-gray-900 dark:hover:text-[#E8E8E6] transition"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Nueva etiqueta
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder="Nombre de la etiqueta"
                                autoFocus
                                className="w-full rounded-lg bg-gray-50 dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] px-3 py-1.5 text-xs text-gray-900 dark:text-[#E8E8E6] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              {/* Color picker */}
                              <div className="flex flex-wrap gap-1.5">
                                {TAG_COLOR_KEYS.map((key) => (
                                  <button
                                    key={key}
                                    type="button"
                                    title={key}
                                    onClick={() => setNewTagColor(key)}
                                    className={cn(
                                      'h-5 w-5 rounded-full transition ring-2 ring-offset-1',
                                      TAG_COLORS[key].dot,
                                      newTagColor === key ? 'ring-gray-900 dark:ring-white' : 'ring-transparent'
                                    )}
                                  />
                                ))}
                              </div>
                              {/* Preview + create */}
                              <div className="flex items-center gap-2">
                                {newTagName && (
                                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', TAG_COLORS[newTagColor].bg, TAG_COLORS[newTagColor].text)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', TAG_COLORS[newTagColor].dot)} />
                                    {newTagName}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={handleCreateTag}
                                  disabled={!newTagName.trim() || creatingTag}
                                  className="ml-auto px-3 py-1 rounded-lg bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] text-xs font-medium hover:opacity-90 transition disabled:opacity-40"
                                >
                                  {creatingTag ? 'Creando…' : 'Crear'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowCreateForm(false)}
                                  className="text-xs text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-gray-300 transition"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className={cn('px-4 pb-4', isConditionOpen ? 'pt-0 border-t border-black/[0.05] dark:border-white/[0.05]' : 'pt-0')}>
                      {isConditionOpen ? (
                        <div className="pt-3 space-y-2">
                          <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-[#555] tracking-wider block">Nota</label>
                          <textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            placeholder="Observaciones de condición…"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-gray-50 dark:bg-[#1D1D1D] px-3 py-2 text-xs text-gray-900 dark:text-[#E8E8E6] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                          />
                          <button
                            type="button"
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="px-3 py-1 rounded-lg bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                          >
                            {savingNotes ? 'Guardando…' : 'Guardar nota'}
                          </button>
                        </div>
                      ) : resource?.condition_notes ? (
                        <p className="text-xs text-gray-500 dark:text-[#787774] pt-1 pb-1">{resource.condition_notes}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1D1D1D]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#242424] shadow-xs flex items-center justify-center">
                        <CalendarDays className="w-5 h-5 text-gray-900 dark:text-[#E8E8E6]" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-[#555] block tracking-wider">Agenda operativa</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Bloques próximos</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {scheduleLoading ? (
                        <p className="text-sm text-gray-500 dark:text-[#787774]">Cargando horarios...</p>
                      ) : upcomingSchedule.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-[#787774]">No hay bloques pendientes o aprobados para este recurso.</p>
                      ) : (
                        upcomingSchedule.slice(0, 3).map((entry) => (
                          <div key={entry.id} className="rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-[#242424]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">{entry.profiles?.full_name || 'Usuario'}</span>
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                entry.status === 'approved'
                                  ? 'bg-[#ECF8F1] text-[#257A4D] dark:bg-[#1B3325] dark:text-[#9ED8B4]'
                                  : 'bg-[#FEF4E8] text-[#B26B1B] dark:bg-[#3A2B1D] dark:text-[#F5C78F]'
                              )}>
                                {entry.status === 'approved' ? 'Aprobada' : 'Pendiente'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                              {entry.startDate}{entry.endDate !== entry.startDate ? ` a ${entry.endDate}` : ''} · {formatAgendaTimeLabel(entry.start_time, entry.end_time)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'codes' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2">
                      <ScanLine className="w-5 h-5 text-gray-500 dark:text-[#787774]" />
                      Códigos para escanear
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-[#787774] mt-1">
                      Cada recurso se identifica por su SKU (<span className="font-mono font-medium text-gray-700 dark:text-[#C8C8C6]">{resource.sku}</span>). Aquí puedes añadir códigos adicionales (QR o barras) que al escanear lleven a este recurso o a una unidad concreta.
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50/50 dark:bg-[#1D1D1D] p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Añadir código</h4>
                    {codeError && (
                      <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{codeError}</p>
                    )}
                    <form onSubmit={handleAddCode} className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={newCode}
                        onChange={(e) => { setNewCode(e.target.value); setCodeError(null); }}
                        placeholder="Ej. QR-IPAD-001 o código de barras"
                        className="flex-1 font-mono uppercase"
                        maxLength={200}
                      />
                      {isReusable && units.length > 0 && (
                        <select
                          value={newCodeUnitId}
                          onChange={(e) => setNewCodeUnitId(e.target.value)}
                          className="h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6]"
                        >
                          <option value="">Todo el recurso</option>
                          {units.map((u: { id: string; serial_number?: string }) => (
                            <option key={u.id} value={u.id}>Unidad: {u.serial_number || u.id.slice(0, 8)}</option>
                          ))}
                        </select>
                      )}
                      <Button type="submit" variant="primary" className="bg-black text-white shrink-0" disabled={addingCode || !newCode.trim()}>
                        {addingCode ? 'Guardando…' : <><Plus className="w-4 h-4 mr-1" /> Añadir</>}
                      </Button>
                    </form>
                  </div>
                  <div className="border border-gray-200 dark:border-[#3A3A3A] rounded-2xl overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50/80 dark:bg-[#1D1D1D] border-b border-gray-200 dark:border-[#3A3A3A]">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Código</th>
                          <th className="py-3 px-4 font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Ámbito</th>
                          <th className="py-3 px-4 font-semibold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px] w-20 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                        {barcodesLoading ? (
                          <tr><td colSpan={3} className="py-8 text-center text-gray-500 dark:text-[#787774]">Cargando…</td></tr>
                        ) : barcodes.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-[#787774]">
                              No hay códigos registrados. El SKU (<span className="font-mono font-medium text-gray-700 dark:text-[#C8C8C6]">{resource.sku}</span>) ya sirve para escanear o buscar. Añade más arriba si usas otros QR o códigos de barras.
                            </td>
                          </tr>
                        ) : (
                          barcodes.map((row) => {
                            const unit = row.unit_id ? units.find((u: { id: string }) => u.id === row.unit_id) : null;
                            return (
                              <tr key={row.code} className="hover:bg-gray-50/50 dark:hover:bg-[#2A2A2A]">
                                <td className="py-3 px-4 font-mono text-gray-900 dark:text-[#E8E8E6]">{row.code}</td>
                                <td className="py-3 px-4 text-gray-600 dark:text-[#AAAAAA]">
                                  {row.unit_id ? (unit ? `Unidad: ${(unit as { serial_number?: string }).serial_number || row.unit_id.slice(0, 8)}` : 'Unidad') : 'Recurso'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCode(row.code)}
                                    disabled={deletingCode === row.code}
                                    className="p-1.5 rounded-md text-gray-400 dark:text-[#555] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
                                    title="Eliminar código"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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

              {activeTab === 'files' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500 dark:text-[#787774]" />
                        Archivos del recurso
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                        Adjunta manuales, facturas, garantías, fichas técnicas o documentos de soporte.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                    </label>
                  </div>

                  {fileError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                      {fileError}
                    </div>
                  )}

                  <div className="rounded-2xl border border-gray-200 dark:border-[#3A3A3A] overflow-hidden">
                    <div className="grid grid-cols-[minmax(0,2fr)_140px_160px_120px] gap-4 border-b border-gray-200 bg-gray-50/80 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:border-[#3A3A3A] dark:bg-[#1D1D1D] dark:text-[#787774]">
                      <span>Archivo</span>
                      <span>Tipo</span>
                      <span>Subido</span>
                      <span>Acciones</span>
                    </div>
                    {filesLoading ? (
                      <div className="px-5 py-10 text-sm text-gray-500 dark:text-[#787774]">Cargando archivos...</div>
                    ) : resourceFiles.length === 0 ? (
                      <div className="px-5 py-10 text-sm text-gray-500 dark:text-[#787774]">Todavía no hay archivos adjuntos para este recurso.</div>
                    ) : (
                      resourceFiles.map((file) => (
                        <div key={file.id} className="grid grid-cols-[minmax(0,2fr)_140px_160px_120px] gap-4 border-b border-gray-100 px-5 py-4 text-sm dark:border-[#2D2D2D]">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-[#E8E8E6] truncate">{file.name}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">{file.uploaded_by || 'Sistema'}</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[#787774]">{file.mime_type || 'Documento'}</p>
                          <p className="text-xs text-gray-500 dark:text-[#787774]">{new Date(file.uploaded_at).toLocaleDateString('es-ES')}</p>
                          <div className="flex items-center gap-2">
                            <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-[#787774] dark:hover:bg-[#2A2A2A]">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <a href={file.url} download className="inline-flex rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-[#787774] dark:hover:bg-[#2A2A2A]">
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-gray-500 dark:text-[#787774]" />
                      Insights del recurso
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                      Resumen operativo del recurso según disponibilidad, agenda, historial y uso reciente.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Disponibilidad</p>
                      <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                        {resource.total_quantity ? Math.round(((resource.available_quantity || 0) / resource.total_quantity) * 100) : 0}%
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Porcentaje libre ahora mismo</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Agenda abierta</p>
                      <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{upcomingSchedule.length}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Bloques pendientes o aprobados</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Historial</p>
                      <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{isReusable ? unitUsageHistory.length : resourceActivity.length}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Eventos registrados</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-5">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Lectura rápida</h4>
                    <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-[#AAAAAA]">
                      <p>Este recurso tiene <span className="font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.available_quantity || 0}</span> unidad(es) disponibles de <span className="font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.total_quantity || resource.initial_quantity || 0}</span>.</p>
                      <p>La próxima ocupación prevista es <span className="font-semibold text-gray-900 dark:text-[#E8E8E6]">{nextScheduleEntry ? `${nextScheduleEntry.startDate} · ${formatAgendaTimeLabel(nextScheduleEntry.start_time, nextScheduleEntry.end_time)}` : 'ninguna por ahora'}</span>.</p>
                      <p>{isReusable ? 'El historial de préstamos y devoluciones se alimenta de las unidades individuales.' : 'El historial se basa en retiros directos del stock consumible.'}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'inventory' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-gray-900 dark:text-[#E8E8E6]">
                      {isReusable ? 'Gestión de Unidades Individuales' : 'Control de Stock Bulk'}
                    </h3>
                    {isReusable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A]"
                        onClick={openAddUnitsModal}
                      >
                        Añadir Unidades
                      </Button>
                    )}
                    {!isReusable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-white dark:bg-[#242424] border-gray-200 dark:border-[#3A3A3A]"
                        onClick={openAdjustStockModal}
                      >
                        Ajustar stock
                      </Button>
                    )}
                  </div>

                  {isReusable ? (
                    <div className="border border-gray-200 dark:border-[#3A3A3A] rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50/80 dark:bg-[#1D1D1D] border-b border-gray-200 dark:border-[#3A3A3A]">
                          <tr>
                            <th className="py-4 px-5 font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Etiqueta / ID</th>
                            <th className="py-4 px-5 font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Núm. Serie</th>
                            <th className="py-4 px-5 font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Estado</th>
                            <th className="py-4 px-5 font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider text-[10px]">Usuario Actual</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2D2D2D]">
                          {units.length > 0 ? units.map((unit) => (
                            <tr key={unit.id} className="hover:bg-gray-50/50 dark:hover:bg-[#2A2A2A] transition-colors">
                              <td className="py-4 px-5 font-bold text-gray-900 dark:text-[#E8E8E6]">{resource.sku}-{unit.serial_number?.split('-').pop() || unit.id.substring(0,4)}</td>
                              <td className="py-4 px-5 text-gray-500 dark:text-[#787774] font-mono text-xs">{unit.serial_number || 'N/A'}</td>
                              <td className="py-4 px-5">
                                <Badge variant={unit.status === 'available' ? 'success' : unit.status === 'on_loan' ? 'info' : 'warning'} className="font-semibold shadow-xs">
                                  {unit.status === 'available' ? 'Disponible' : unit.status === 'on_loan' ? 'Prestado' : 'Mantenimiento'}
                                </Badge>
                              </td>
                              <td className="py-4 px-5 text-gray-900 dark:text-[#E8E8E6] font-medium">
                                {unit.loans?.find((loan: any) => loan.status === 'active' || loan.status === 'overdue') ? (
                                  <div className="space-y-1">
                                  <Link href={`/usuarios?id=${unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').user_id}`} className="text-blue-600 hover:underline flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-[10px]">
                                      {unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').profiles?.full_name?.charAt(0)}
                                    </div>
                                    {unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').profiles?.full_name}
                                  </Link>
                                  <p className="text-[11px] text-gray-500 dark:text-[#787774]">
                                    Previsto: {unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').requests?.needed_until || unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').due_date || 'Sin fecha'} · {formatAgendaTimeLabel(undefined, unit.loans.find((loan: any) => loan.status === 'active' || loan.status === 'overdue').requests?.end_time)}
                                  </p>
                                  </div>
                                ) : <span className="text-gray-300 dark:text-[#444]">—</span>}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-gray-500 dark:text-[#787774] font-medium">
                                No se encontraron unidades individuales para este recurso.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-gray-50/55 dark:bg-white/[0.03] rounded-2xl p-8 flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-white dark:bg-[#242424] shadow-sm flex items-center justify-center mb-4">
                        <Layers className="w-8 h-8 text-gray-400 dark:text-[#555]" />
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-[#E8E8E6] text-lg">Control de Stock Bulk</h4>
                      <p className="text-gray-500 dark:text-[#787774] text-sm max-w-sm mt-2">
                        Este recurso se gestiona por cantidad total. No tiene números de serie individuales.
                      </p>
                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900 dark:text-[#E8E8E6]">{resource.available_quantity}</span>
                        <span className="text-gray-500 dark:text-[#787774] font-medium">unidades disponibles en stock</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-6 bg-white dark:bg-[#242424]"
                        onClick={openAdjustStockModal}
                      >
                        Ajustar stock actual
                      </Button>
                    </div>
                  )}

                  {isReusable && (
                    <div className="rounded-2xl bg-gray-50/60 p-5 dark:bg-[#1D1D1D]">
                      <div className="flex items-center gap-3">
                        <History className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Historial de uso</h4>
                          <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                            Quién ha usado cada unidad y cuándo debería volver si aún sigue en préstamo.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {unitUsageHistory.length === 0 ? (
                          <div className="rounded-xl bg-white/80 px-4 py-5 text-sm text-gray-500 dark:bg-[#242424] dark:text-[#787774]">
                            Aún no hay historial de uso para este recurso.
                          </div>
                        ) : (
                          unitUsageHistory.slice(0, 8).map((entry) => (
                            <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-4 py-3 dark:bg-[#242424]">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                                  {entry.full_name || 'Usuario'} · {entry.serial_number || 'Unidad'}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                                  {entry.status === 'returned' ? 'Devuelto' : 'En uso'} · Previsto {entry.needed_until || entry.due_date || 'sin fecha'} · {formatAgendaTimeLabel(undefined, entry.end_time)}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-gray-400 dark:text-[#555]">
                                {entry.return_date || entry.due_date || '—'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {!isReusable && (
                    <div className="rounded-2xl bg-gray-50/60 p-5 dark:bg-[#1D1D1D]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Historial de retiros</h4>
                          <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                            Quién ha ido tomando unidades de este recurso consumible.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {activityLoading ? (
                          <p className="text-sm text-gray-500 dark:text-[#787774]">Cargando historial…</p>
                        ) : resourceActivity.length === 0 ? (
                          <div className="rounded-xl bg-white/80 px-4 py-5 text-sm text-gray-500 dark:bg-[#242424] dark:text-[#787774]">
                            Aún no hay retiros registrados para este recurso.
                          </div>
                        ) : (
                          resourceActivity.map((entry) => (
                            <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-4 py-3 dark:bg-[#242424]">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                                  {entry.profiles?.full_name || entry.details?.actor_name || 'Usuario'}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-[#787774]">
                                  Retiró {entry.details?.quantity || 0} unidad(es)
                                  {entry.details?.use_location ? ` • ${entry.details.use_location}` : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-gray-400 dark:text-[#555]">
                                {new Date(entry.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Image & History */}
            <div className="space-y-10">
              {/* Image Gallery */}
              <div className="space-y-4">
                 <div className="group relative bg-gray-50 dark:bg-[#1D1D1D] rounded-3xl aspect-[4/3] flex items-center justify-center p-8 overflow-hidden shadow-inner">
                  <img
                    src={resource.image_url || 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg'}
                    alt={resource.name}
                    className={cn(
                      "w-full h-full object-contain transition-transform duration-700 group-hover:scale-105",
                      !resource.image_url && "opacity-20 p-8"
                    )}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg';
                      (e.target as HTMLImageElement).classList.add('opacity-20', 'p-8');
                    }}
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Stats/Quick Actions */}
              <div className="p-6 rounded-2xl bg-gray-900 text-white shadow-xl shadow-gray-200/50">
                <h3 className="font-bold text-sm uppercase tracking-[0.2em] mb-4 text-gray-400">Estado Rápido</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Tipo de Propiedad</span>
                    <span className="text-sm font-bold capitalize">
                      {getCatalogVisibility(resource) === 'internal'
                        ? 'Solo administración'
                        : getCatalogVisibility(resource) === 'restricted'
                          ? 'Visible por área / asignado'
                          : 'Catálogo público'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Dueño/Área</span>
                    <span className="text-sm font-bold">{resource.owner_name || 'Institucional'}</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-gray-800">
                    <button
                      type="button"
                      className="w-full py-2.5 bg-white text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                      onClick={() => setPrintModalOpen(true)}
                    >
                      <Printer className="w-4 h-4" /> Imprimir Todas las Etiquetas
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Imprimir etiquetas */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#242424] rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6] flex items-center gap-2">
                <Printer className="w-5 h-5" /> Imprimir etiquetas
              </h3>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#AAAAAA] hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <p className="text-sm text-gray-600 dark:text-[#AAAAAA]">
                Elige qué etiquetas generar. Cada una incluirá el nombre del recurso, el código y un QR para escanear.
              </p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#3A3A3A] hover:border-gray-300 dark:hover:border-[#444] cursor-pointer">
                  <input
                    type="radio"
                    name="printOption"
                    checked={printOption === 'resource'}
                    onChange={() => setPrintOption('resource')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">Una etiqueta (recurso)</span>
                    <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">Solo el SKU del recurso. 1 etiqueta.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#3A3A3A] hover:border-gray-300 dark:hover:border-[#444] cursor-pointer">
                  <input
                    type="radio"
                    name="printOption"
                    checked={printOption === 'per_unit'}
                    onChange={() => setPrintOption('per_unit')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">Una etiqueta por unidad</span>
                    <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">
                      {isReusable && units.length > 0 ? `${units.length} etiquetas (nº de serie por unidad).` : 'Una etiqueta (recurso).'}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#3A3A3A] hover:border-gray-300 dark:hover:border-[#444] cursor-pointer">
                  <input
                    type="radio"
                    name="printOption"
                    checked={printOption === 'all_codes'}
                    onChange={() => setPrintOption('all_codes')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-[#E8E8E6]">Recurso + códigos registrados</span>
                    <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">
                      SKU + todos los códigos de la pestaña &quot;Códigos para escanear&quot;. {1 + barcodes.length} etiqueta(s).
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setPrintModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="primary" className="flex-1 bg-black text-white" onClick={printBulkLabels}>
                  <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addUnitsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-[#242424]">
            <div className="flex items-center justify-between p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Añadir unidades</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                  Se crearán nuevas unidades individuales para este recurso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !addingUnits && setAddUnitsModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-[#555] dark:hover:bg-[#2A2A2A] dark:hover:text-[#AAAAAA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 pb-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Cantidad</span>
                  <Input
                    type="number"
                    min="1"
                    value={unitsToAdd}
                    onChange={(e) => setUnitsToAdd(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Prefijo</span>
                  <Input
                    value={unitPrefix}
                    onChange={(e) => setUnitPrefix(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Desde</span>
                  <Input
                    type="number"
                    min="1"
                    value={unitStartNumber}
                    onChange={(e) => setUnitStartNumber(e.target.value)}
                  />
                </label>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-[#1D1D1D] dark:text-[#AAAAAA]">
                Próxima unidad sugerida: <span className="font-mono text-gray-900 dark:text-[#E8E8E6]">{defaultUnitPrefix}-{String(nextUnitNumber).padStart(3, '0')}</span>
              </div>
              {addUnitsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                  {addUnitsError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setAddUnitsModalOpen(false)} disabled={addingUnits}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-black text-white hover:bg-gray-800"
                  onClick={handleAddUnits}
                  disabled={addingUnits}
                >
                  {addingUnits ? 'Creando…' : 'Crear unidades'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {adjustStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-[#242424]">
            <div className="flex items-center justify-between p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Actualizar stock</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                  Define la cantidad disponible actual para este consumible.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !adjustingStock && setAdjustStockModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-[#555] dark:hover:bg-[#2A2A2A] dark:hover:text-[#AAAAAA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 pb-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Stock disponible</span>
                <Input
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </label>
              {stockError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                  {stockError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setAdjustStockModalOpen(false)} disabled={adjustingStock}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-black text-white hover:bg-gray-800"
                  onClick={handleAdjustStock}
                  disabled={adjustingStock}
                >
                  {adjustingStock ? 'Guardando…' : 'Guardar stock'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
