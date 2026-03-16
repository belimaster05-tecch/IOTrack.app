'use client'
import { useEffect, useMemo, useState } from 'react';
import { Download, Calendar as CalendarIcon, Filter, TrendingUp, Package, AlertTriangle, Clock, ChevronDown, User2, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useLoans, useResources, useDepartments } from '@/lib/hooks';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

function monthLabel(date: Date) {
  return date.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
}

export function Reports() {
  const { loans, loading: loadingLoans } = useLoans();
  const { resources, loading: loadingResources } = useResources();
  const { departments } = useDepartments();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [consumableLogs, setConsumableLogs] = useState<any[]>([]);
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    resources: false,
    users: false,
  });

  useEffect(() => {
    const fetchConsumableLogs = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('id, user_id, created_at, details, profiles(full_name)')
        .eq('action', 'consumable_checkout')
        .order('created_at', { ascending: false })
        .limit(400);
      setConsumableLogs(data ?? []);
    };
    fetchConsumableLogs();
  }, []);

  const filteredLoans = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    return loans.filter(l => {
      const dateStr = l.created_at || l.start_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [loans, dateFrom, dateTo]);

  const dataLoans = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d), prestamos: 0, devoluciones: 0 };
    });
    filteredLoans.forEach(l => {
      const dateStr = l.created_at || l.start_date;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find(m => m.key === key);
      if (!bucket) return;
      bucket.prestamos += 1;
      const returned = (['returned', 'completed', 'closed'].includes((l.status || '').toLowerCase())) || Boolean((l as any).return_date || (l as any).returned_at || (l as any).end_date);
      if (returned) bucket.devoluciones += 1;
    });
    return months.map(m => ({ name: m.label[0].toUpperCase() + m.label.slice(1), prestamos: m.prestamos, devoluciones: m.devoluciones }));
  }, [filteredLoans]);

  const dataCategories = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach(r => {
      const name = r.categories?.name || 'General';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [resources]);

  const dataDepartments = useMemo(() => {
    const byDept = new Map<string, number>();
    filteredLoans.forEach(l => {
      const prof = l.profiles;
      const deptId = prof?.department_id;
      const name = deptId ? (departments.find(d => d.id === deptId)?.name || 'Otro') : 'Sin departamento';
      byDept.set(name, (byDept.get(name) || 0) + 1);
    });
    return Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredLoans, departments]);

  const dataLocations = useMemo(() => {
    const byLoc = new Map<string, number>();
    resources.forEach(r => {
      const name = r.locations?.name || 'No asignada';
      byLoc.set(name, (byLoc.get(name) || 0) + 1);
    });
    return Array.from(byLoc.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [resources]);

  const topResources = useMemo(() => {
    const map = new Map<string, { name: string; usage: number; loans: number; consumables: number }>();
    filteredLoans.forEach((loan: any) => {
      const id = loan.resource_units?.resource_id || loan.resource_units?.resources?.name;
      const name = loan.resource_units?.resources?.name || 'Recurso';
      if (!id) return;
      const current = map.get(id) || { name, usage: 0, loans: 0, consumables: 0 };
      current.usage += 1;
      current.loans += 1;
      map.set(id, current);
    });
    consumableLogs.forEach((entry: any) => {
      const id = entry.entity_id || entry.details?.resource_name;
      const name = entry.details?.resource_name || 'Consumible';
      const qty = Number(entry.details?.quantity || 1);
      if (!id) return;
      const current = map.get(id) || { name, usage: 0, loans: 0, consumables: 0 };
      current.usage += qty;
      current.consumables += qty;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.usage - a.usage);
  }, [consumableLogs, filteredLoans]);

  const topUsers = useMemo(() => {
    const map = new Map<string, { name: string; usage: number; loans: number; consumables: number }>();
    filteredLoans.forEach((loan: any) => {
      const id = loan.user_id || loan.profiles?.full_name;
      const name = loan.profiles?.full_name || 'Usuario';
      if (!id) return;
      const current = map.get(id) || { name, usage: 0, loans: 0, consumables: 0 };
      current.usage += 1;
      current.loans += 1;
      map.set(id, current);
    });
    consumableLogs.forEach((entry: any) => {
      const id = entry.user_id || entry.profiles?.full_name || entry.details?.actor_name;
      const name = entry.profiles?.full_name || entry.details?.actor_name || 'Usuario';
      const qty = Number(entry.details?.quantity || 1);
      if (!id) return;
      const current = map.get(id) || { name, usage: 0, loans: 0, consumables: 0 };
      current.usage += qty;
      current.consumables += qty;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) => b.usage - a.usage);
  }, [consumableLogs, filteredLoans]);

  const averageUsageDays = useMemo(() => {
    const durations = filteredLoans
      .map((loan: any) => {
        const start = loan.created_at || loan.start_date;
        const end = loan.return_date || loan.due_date;
        if (!start || !end) return null;
        const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
        return diff / (1000 * 60 * 60 * 24);
      })
      .filter((value): value is number => value !== null);
    if (durations.length === 0) return '—';
    return `${(durations.reduce((sum, current) => sum + current, 0) / durations.length).toFixed(1)} d`;
  }, [filteredLoans]);

  const togglePanel = (key: 'resources' | 'users') => {
    setExpandedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderUsageList = (
    key: 'resources' | 'users',
    title: string,
    subtitle: string,
    rows: Array<{ name: string; usage: number; loans: number; consumables: number }>,
    icon: React.ReactNode
  ) => {
    const visibleRows = expandedPanels[key] ? rows : rows.slice(0, 5);
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{title}</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">{subtitle}</p>
          </div>
          {rows.length > 5 && (
            <button
              type="button"
              onClick={() => togglePanel(key)}
              className="inline-flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-[#C8C8C6]"
            >
              {expandedPanels[key] ? 'Ver menos' : 'Ver más'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', expandedPanels[key] && 'rotate-180')} />
            </button>
          )}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-[#2D2D2D]">
          <div className="grid grid-cols-[minmax(0,2fr)_100px_100px_100px] gap-4 border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:border-[#2D2D2D] dark:bg-[#1D1D1D] dark:text-[#787774]">
            <span>{key === 'resources' ? 'Recurso' : 'Usuario'}</span>
            <span>Uso</span>
            <span>Préstamos</span>
            <span>Consumo</span>
          </div>
          {visibleRows.length === 0 ? (
            <div className="px-4 py-10 text-sm text-gray-500 dark:text-[#787774]">No hay datos suficientes todavía.</div>
          ) : (
            visibleRows.map((row, index) => (
              <div key={`${row.name}-${index}`} className="grid grid-cols-[minmax(0,2fr)_100px_100px_100px] gap-4 border-b border-gray-100 px-4 py-3 text-sm dark:border-[#2D2D2D]">
                <span className="font-medium text-gray-900 dark:text-[#E8E8E6] truncate">{row.name}</span>
                <span className="text-gray-600 dark:text-[#AAAAAA]">{row.usage}</span>
                <span className="text-gray-600 dark:text-[#AAAAAA]">{row.loans}</span>
                <span className="text-gray-600 dark:text-[#AAAAAA]">{row.consumables}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    );
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      setMessage(null);
      setMessageType(null);
      const lines: string[] = [];
      lines.push('Prestamos vs Devoluciones');
      lines.push('Mes,Prestamos,Devoluciones');
      dataLoans.forEach(row => {
        lines.push(`${row.name},${row.prestamos},${row.devoluciones}`);
      });
      lines.push('');
      lines.push('Uso por Categoria');
      lines.push('Categoria,Total');
      dataCategories.forEach(row => {
        lines.push(`${row.name},${row.value}`);
      });
      lines.push('');
      lines.push('Prestamos por Departamento');
      lines.push('Departamento,Total');
      dataDepartments.forEach(row => {
        lines.push(`${row.name},${row.value}`);
      });
      lines.push('');
      lines.push('Recursos por Ubicacion');
      lines.push('Ubicacion,Total');
      dataLocations.forEach(row => {
        lines.push(`${row.name},${row.value}`);
      });
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reportes_invtrack.csv';
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Exportación CSV completada');
      setMessageType('success');
    } catch {
      setMessage('No se pudo exportar CSV');
      setMessageType('error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Reportes y Analíticas</h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">Visualiza el rendimiento, uso de recursos y métricas clave.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-[#242424] rounded-xl p-2">
            <CalendarIcon className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-[#3A3A3A] rounded-md bg-white dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
            />
            <span className="text-xs text-gray-500 dark:text-[#787774]">a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-[#3A3A3A] rounded-md bg-white dark:bg-[#1D1D1D] dark:text-[#E8E8E6]"
            />
          </div>
          <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Limpiar filtros
          </Button>
          <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => window.print()}>
            Exportar PDF
          </Button>
          <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={handleExportCSV} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>
      {(message && messageType) && (
        <div className={`p-4 rounded-lg border ${messageType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40' : 'bg-error-50 dark:bg-red-950/20 text-error-700 dark:text-red-400 border-error-200 dark:border-red-900/40'}`}>
          {message}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-indigo-200 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loadingLoans ? '...' : `${Math.min(100, Math.round(((loans.filter(l => l.status === 'active' || l.status === 'overdue').length) / Math.max(loans.length, 1)) * 100))}%`}</p>
                <span className="text-xs font-medium text-success-600">↑5%</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Tasa de Utilización</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] flex items-center justify-center text-gray-900 dark:text-[#E8E8E6] shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loadingLoans ? '...' : filteredLoans.length}</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Préstamos Totales</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-error-200 bg-error-50 dark:bg-red-950/20 flex items-center justify-center text-error-600 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loadingLoans ? '...' : `${Math.min(100, Math.round(((filteredLoans.filter(l => l.status === 'overdue').length) / Math.max(filteredLoans.length, 1)) * 100))}%`}</p>
                <span className="text-xs font-medium text-error-600">↑2%</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Tasa de Vencimiento</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tracking-tight">{loadingLoans ? '...' : averageUsageDays}</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Días Promedio de Uso</p>
            </div>
          </div>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Préstamos vs Devoluciones</h3>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Tendencia de los últimos 7 meses</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dataLoans}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorPrestamos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDevoluciones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Area type="monotone" dataKey="prestamos" stroke="#111827" strokeWidth={2} fillOpacity={1} fill="url(#colorPrestamos)" name="Préstamos" />
                <Area type="monotone" dataKey="devoluciones" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorDevoluciones)" name="Devoluciones" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Recursos por Ubicación</h3>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Distribución del inventario</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataLocations}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} width={160} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} barSize={24} name="Recursos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Uso por Categoría</h3>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Distribución de recursos más solicitados</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataCategories}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} width={100} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} barSize={24} name="Préstamos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {/* Chart 3 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">Préstamos por Departamento</h3>
              <p className="text-sm text-gray-500 dark:text-[#787774]">Top áreas con más actividad</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataDepartments}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} width={140} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} barSize={24} name="Préstamos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {renderUsageList(
          'resources',
          'Recursos más usados',
          'Combina préstamos y retiros consumibles para ver qué se mueve más.',
          topResources,
          <Boxes className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
        )}
        {renderUsageList(
          'users',
          'Usuarios con más actividad',
          'Quién usa más recursos, tanto por préstamo como por consumo directo.',
          topUsers,
          <User2 className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
        )}
      </div>
    </div>
  );
}
