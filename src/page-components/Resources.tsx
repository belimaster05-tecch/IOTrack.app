'use client'
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  Package,
  Shield,
  UserRound,
  Sparkles,
  Layers,
} from 'lucide-react';
import { getCategoryIconComponent } from '@/lib/categoryIcons';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useResources, useConditionTags } from '@/lib/hooks';
import { TAG_COLORS } from '@/lib/conditionTags';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCatalogVisibility, isVisibleInCatalog } from '@/lib/resourceVisibility';


type SegmentFilter = 'catalogo' | 'internos' | 'asignados' | 'todos';


const segmentCopy: Record<SegmentFilter, { label: string; descAdmin: string; descEmployee: string }> = {
  catalogo: {
    label: 'Catálogo',
    descAdmin: 'Recursos públicos disponibles para solicitud.',
    descEmployee: 'Recursos disponibles para solicitar.',
  },
  internos: {
    label: 'Solo gestión',
    descAdmin: 'Activos internos y de control administrativo.',
    descEmployee: 'Activos internos y de control administrativo.',
  },
  asignados: {
    label: 'Asignados',
    descAdmin: 'Activos fijos vinculados a personas o áreas.',
    descEmployee: 'Recursos asignados a tu nombre.',
  },
  todos: {
    label: 'Todo',
    descAdmin: 'Vista completa del inventario de la organización.',
    descEmployee: 'Vista completa del inventario de la organización.',
  },
};

export function Resources() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('catalogo');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { resources, loading: isLoadingData, error } = useResources();
  const { tags: orgTags } = useConditionTags();
  const { role } = useRole();
  const { user } = useAuth();
  const router = useRouter();

  const isAdmin = role === 'admin';
  // Approvers and admins can see all visibility tiers (restricted + internal).
  // Regular employees only see public + their own assigned resources.
  const canSeeAll = role === 'admin' || role === 'approver';

  const handleImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      toast.success('Importación completada');
    }, 2000);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast.success('Exportación completada');
    }, 2000);
  };

  const visibleResources = useMemo(() => {
    return resources.filter((resource) => isVisibleInCatalog(resource, canSeeAll, user?.id));
  }, [canSeeAll, user?.id, resources]);

  const categories = useMemo(() => {
    const map = new Map<string, string | null>();
    visibleResources.forEach((resource) => {
      const name = resource.categories?.name || 'General';
      if (!map.has(name)) map.set(name, resource.categories?.icon_name ?? null);
    });
    return [
      { name: 'Todas', icon_name: null as string | null },
      ...Array.from(map.entries()).map(([name, icon_name]) => ({ name, icon_name })),
    ];
  }, [visibleResources]);

  const filteredResources = useMemo(() => {
    return visibleResources.filter((resource) => {
      const matchesSearch =
        resource.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const categoryName = resource.categories?.name || 'General';
      if (selectedCategory !== 'Todas' && categoryName !== selectedCategory) return false;

      if (selectedTagIds.length > 0) {
        const rTagIds = (resource.resource_condition_tags || [])
          .map((rct: any) => rct.condition_tags?.id)
          .filter(Boolean);
        if (!selectedTagIds.some((tid) => rTagIds.includes(tid))) return false;
      }

      const visibility = getCatalogVisibility(resource);
      if (segmentFilter === 'catalogo') return visibility === 'public';
      if (segmentFilter === 'asignados') return visibility === 'restricted';
      if (segmentFilter === 'internos') return isAdmin ? visibility === 'internal' : false;
      return true;
    });
  }, [visibleResources, searchQuery, selectedCategory, segmentFilter, isAdmin]);

  const featuredResources = useMemo(
    () =>
      filteredResources
        .filter((resource) => (resource.available_quantity ?? 0) > 0)
        .slice(0, 4),
    [filteredResources]
  );

  const groupedResources = useMemo(() => {
    const groups = new Map<string, any[]>();
    filteredResources.forEach((resource) => {
      const categoryName = resource.categories?.name || 'General';
      const existing = groups.get(categoryName) || [];
      existing.push(resource);
      groups.set(categoryName, existing);
    });
    return Array.from(groups.entries());
  }, [filteredResources]);

  const renderResourceCard = (resource: any, compact = false) => {
    const Icon = getCategoryIconComponent(resource.categories?.icon_name);
    const visibility = getCatalogVisibility(resource);
    const isAssigned = visibility === 'restricted';
    const isInternal = visibility === 'internal';
    const stockLabel = resource.type === 'consumable' ? 'en stock' : 'disponibles';
    const availability = (resource.total_quantity ?? 0) > 0
      ? Math.min(100, ((resource.available_quantity ?? 0) / (resource.total_quantity ?? 1)) * 100)
      : 0;

    return (
      <div
        key={resource.id}
        onClick={() => router.push(`/recursos/${resource.id}`)}
        className={cn(
          'group cursor-pointer overflow-hidden rounded-[28px] transition-all duration-300',
          compact
            ? 'bg-white/80 p-3 hover:bg-white dark:bg-[#242424]/80 dark:hover:bg-[#242424]'
            : 'bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 dark:bg-[#242424] dark:shadow-none'
        )}
      >
        <div className={cn('relative overflow-hidden', compact ? 'rounded-2xl' : 'rounded-[24px]')}>
          <div className={cn('absolute left-3 top-3 z-10 flex flex-wrap gap-2', compact && 'left-2 top-2')}>
            <Badge className="border-0 bg-white/92 text-gray-700 backdrop-blur-sm dark:bg-[#1D1D1D]/92 dark:text-[#E8E8E6]">
              {resource.categories?.name || 'General'}
            </Badge>
            {isInternal && (
              <Badge className="border-0 bg-slate-900 text-white dark:bg-[#111] dark:text-[#E8E8E6]">
                <Shield className="mr-1 h-3 w-3" /> Solo admin
              </Badge>
            )}
            {isAssigned && (
              <Badge className="border-0 bg-[#EEF4FF] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]">
                <UserRound className="mr-1 h-3 w-3" /> Asignado
              </Badge>
            )}
            {(resource.resource_condition_tags || []).slice(0, 2).map((rct: any) => {
              const tag = rct.condition_tags;
              if (!tag) return null;
              const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
              return (
                <Badge key={tag.id} className={cn('border-0', c.bg, c.text)}>
                  <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', c.dot)} />
                  {tag.name}
                </Badge>
              );
            })}
          </div>
          <div className={cn('flex items-center justify-center bg-[#F6F6F3] dark:bg-[#1D1D1D]', compact ? 'h-32' : 'h-52')}>
            <img
              src={resource.image_url || 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg'}
              alt={resource.name}
              className={cn(
                'h-full w-full object-cover transition-transform duration-700 group-hover:scale-105',
                !resource.image_url && 'object-contain p-10 opacity-20'
              )}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg';
                (e.target as HTMLImageElement).classList.add('object-contain', 'p-10', 'opacity-20');
              }}
            />
          </div>
        </div>

        <div className={cn(compact ? 'px-1 pb-1 pt-3' : 'p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.name}</h3>
              <p className="mt-1 text-xs font-mono text-gray-500 dark:text-[#787774]">{resource.sku}</p>
            </div>
            <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-[#1D1D1D] dark:text-[#C8C8C6]">
              {resource.type === 'consumable' ? 'Bulk' : 'Serie'}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#AAAAAA]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F6F6F3] dark:bg-[#1D1D1D]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-[#787774]">Ubicación</p>
                <p className="truncate text-sm font-medium text-gray-800 dark:text-[#E8E8E6]">
                  {resource.locations?.name || 'No asignada'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7F7F5] px-4 py-3 dark:bg-[#1D1D1D]">
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 dark:text-[#787774]">
                <span>{isAssigned ? 'Asignado a' : 'Disponibilidad'}</span>
                {!isAssigned && (
                  <span className="tabular-nums text-gray-800 dark:text-[#E8E8E6]">
                    {resource.available_quantity ?? 0}/{resource.total_quantity ?? 0}
                  </span>
                )}
              </div>
              {isAssigned || isInternal ? (
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">
                  <UserRound className="h-4 w-4 text-gray-500 dark:text-[#787774]" />
                  <span>{resource.owner_name || (isInternal ? 'Uso interno' : 'Asignación interna')}</span>
                </div>
              ) : (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-[#2B2B2B]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        availability > 50 ? 'bg-emerald-500' : availability > 0 ? 'bg-amber-500' : 'bg-rose-500'
                      )}
                      style={{ width: `${availability}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-[#787774]">
                    {(resource.available_quantity ?? 0)} {stockLabel}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {isAssigned || isInternal ? (
              <Button variant="secondary" className="w-full bg-[#F3F4F6] dark:bg-[#1D1D1D]" onClick={(e) => {
                e.stopPropagation();
                router.push(`/recursos/${resource.id}`);
              }}>
                Ver ficha
              </Button>
            ) : (
              <Button
                variant="primary"
                className="w-full bg-[#111827] text-white hover:bg-black dark:bg-[#E8E8E6] dark:text-[#191919] dark:hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/solicitar?resource=${resource.id}`);
                }}
              >
                Solicitar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-error-700">
          No se pudo cargar recursos
        </div>
      )}

      <section className="rounded-[32px] bg-transparent p-2 dark:bg-transparent">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur dark:bg-[#1D1D1D]/80 dark:text-[#C8C8C6]">
              <Sparkles className="h-3.5 w-3.5" />
              Panel de recursos
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Recursos</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-[#787774]">
              Explora el inventario como catálogo, con separación entre recursos públicos, activos internos y asignaciones fijas.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={handleImport} disabled={isImporting || isExporting}>
              {isImporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Importar
            </Button>
            <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={handleExport} disabled={isExporting || isImporting}>
              {isExporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar
            </Button>
            <Button variant="primary" className="bg-black text-white hover:bg-gray-800 dark:bg-[#E8E8E6] dark:text-[#191919] dark:hover:bg-white" onClick={() => router.push('/recursos/nuevo')}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo recurso
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white/35 p-4 backdrop-blur-sm dark:bg-white/[0.03]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-[#555]" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-[#3A3A3A] dark:bg-[#242424] dark:text-[#E8E8E6] dark:focus:border-[#E8E8E6] dark:focus:ring-[#E8E8E6]/10"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => {
                const CatIcon = getCategoryIconComponent(category.icon_name);
                const isSelected = selectedCategory === category.name;
                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => setSelectedCategory(category.name)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                      isSelected
                        ? 'bg-gray-900 text-white dark:bg-[#E8E8E6] dark:text-[#191919]'
                        : 'bg-[#F3F4F6] text-gray-600 hover:bg-[#E7E8EB] dark:bg-[#1D1D1D] dark:text-[#C8C8C6] dark:hover:bg-[#2A2A2A]'
                    )}
                  >
                    {category.name !== 'Todas' && <CatIcon className="h-3 w-3" />}
                    {category.name}
                  </button>
                );
              })}
            </div>

            {orgTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-[#555]">Condición</span>
                {orgTags.map((tag) => {
                  const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          isSelected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition',
                        isSelected
                          ? cn(c.bg, c.text, 'ring-1 ring-current')
                          : 'bg-[#F3F4F6] text-gray-600 hover:bg-[#E7E8EB] dark:bg-[#1D1D1D] dark:text-[#C8C8C6] dark:hover:bg-[#2A2A2A]'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', isSelected ? c.dot : 'bg-gray-300 dark:bg-[#555]')} />
                      {tag.name}
                    </button>
                  );
                })}
                {selectedTagIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTagIds([])}
                    className="text-[10px] text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-gray-300 transition underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] bg-[#111827] p-4 text-white dark:bg-[#161616]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">Vista activa</p>
                <h2 className="mt-2 text-lg font-semibold">{segmentCopy[segmentFilter].label}</h2>
                {segmentFilter === 'asignados' && !canSeeAll && (
                  <p className="text-[10px] text-white/50 mt-0.5">Solo los tuyos</p>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/10 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn('rounded-full p-2 transition', viewMode === 'grid' ? 'bg-white text-gray-900' : 'text-white/70')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn('rounded-full p-2 transition', viewMode === 'list' ? 'bg-white text-gray-900' : 'text-white/70')}
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-white/65">
              {canSeeAll ? segmentCopy[segmentFilter].descAdmin : segmentCopy[segmentFilter].descEmployee}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['catalogo', 'asignados', ...(canSeeAll ? (['internos', 'todos'] as SegmentFilter[]) : [])] as SegmentFilter[]).map((segment) => (
                <button
                  key={segment}
                  type="button"
                  onClick={() => setSegmentFilter(segment)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition',
                    segmentFilter === segment ? 'bg-white text-gray-900' : 'bg-white/10 text-white/80 hover:bg-white/15'
                  )}
                >
                  {segmentCopy[segment].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isLoadingData ? (
        <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-500 dark:text-[#787774]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900 dark:border-[#3A3A3A] dark:border-t-[#E8E8E6]" />
          Cargando recursos...
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400 dark:text-[#555]" />
          </div>
          <p className="font-medium text-gray-900 dark:text-[#E8E8E6] text-sm">Sin recursos todavía</p>
          <p className="text-xs text-gray-400 dark:text-[#555] max-w-xs">Agrega el primer recurso para comenzar a gestionar el inventario.</p>
          {isAdmin && (
            <Link href="/recursos/nuevo" className="mt-1 px-3 py-1.5 bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
              Agregar recurso
            </Link>
          )}
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Sin resultados</p>
          <p className="text-xs text-gray-400 dark:text-[#555]">Intenta con otros términos de búsqueda.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-8">
          {featuredResources.length > 0 && !searchQuery && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-[#787774]">Selección</p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Recursos destacados</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-[#787774]">Listos para solicitar o revisar</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {featuredResources.map((resource) => renderResourceCard(resource, true))}
              </div>
            </section>
          )}

          {groupedResources.map(([groupName, items]) => (
            <section key={groupName} className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-[#787774]">Categoría</p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{groupName}</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-[#787774]">{items.length} recurso(s)</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {items.map((resource) => renderResourceCard(resource))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:bg-[#242424] dark:shadow-none">
          {/* Column header */}
          <div className="hidden sm:grid grid-cols-[1fr_160px_44px] gap-4 border-b border-black/[0.05] dark:border-white/[0.04] px-5 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-[#555]">Recurso</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-[#555]">Disponibilidad</span>
            <span />
          </div>

          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {filteredResources.map((resource) => {
              const Icon = getCategoryIconComponent(resource.categories?.icon_name);
              const visibility = getCatalogVisibility(resource);
              const isAssigned = visibility === 'restricted';
              const isInternal = visibility === 'internal';
              const avail = resource.available_quantity ?? 0;
              const total = resource.total_quantity ?? 0;
              const pct = total > 0 ? Math.min(100, (avail / total) * 100) : 0;
              const barColor = pct > 50 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-rose-400';

              return (
                <div
                  key={resource.id}
                  onClick={() => router.push(`/recursos/${resource.id}`)}
                  className="group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#F7F7F6] dark:hover:bg-[#2A2A2A]"
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[16px] bg-[#F4F4F2] dark:bg-[#1D1D1D] ring-1 ring-black/[0.04] dark:ring-white/[0.05]">
                    <img
                      src={resource.image_url || 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg'}
                      alt={resource.name}
                      className={cn('h-full w-full object-cover transition-transform duration-300 group-hover:scale-105', !resource.image_url && 'object-contain p-3 opacity-20')}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg';
                        (e.target as HTMLImageElement).classList.add('object-contain', 'p-3', 'opacity-20');
                      }}
                    />
                  </div>

                  {/* Name + tags */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">{resource.name}</h3>
                      {resource.sku && (
                        <span className="font-mono text-[11px] text-gray-400 dark:text-[#555]">{resource.sku}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-[6px] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-600 dark:text-[#AAAAAA]">
                        <Icon className="h-3 w-3" />{resource.categories?.name || 'General'}
                      </span>
                      {resource.locations?.name && (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-600 dark:text-[#AAAAAA]">
                          <MapPin className="h-3 w-3" />{resource.locations.name}
                        </span>
                      )}
                      {isInternal && (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-gray-900 px-2 py-0.5 text-[11px] text-white dark:bg-[#111] dark:text-[#E8E8E6]">
                          <Shield className="h-3 w-3" />Solo admin
                        </span>
                      )}
                      {isAssigned && (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#EEF4FF] px-2 py-0.5 text-[11px] text-[#3159B8] dark:bg-[#1E2A40] dark:text-[#A7C0FF]">
                          <UserRound className="h-3 w-3" />Asignado
                        </span>
                      )}
                      {(resource.resource_condition_tags || []).map((rct: any) => {
                        const tag = rct.condition_tags;
                        if (!tag) return null;
                        const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                        return (
                          <span key={tag.id} className={cn('inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px]', c.bg, c.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                            {tag.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="hidden w-40 shrink-0 sm:block">
                    {isAssigned || isInternal ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#787774]">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{resource.owner_name || (isInternal ? 'Uso interno' : 'Asignación interna')}</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400 dark:text-[#555]">Disponible</span>
                          <span className={cn(
                            'text-[11px] font-semibold tabular-nums',
                            pct > 50 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500'
                          )}>
                            {avail}/{total}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-[#333]">
                          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Button
                    variant={isAssigned || isInternal ? 'secondary' : 'primary'}
                    size="sm"
                    className={cn(
                      'shrink-0',
                      !(isAssigned || isInternal) && 'bg-emerald-600 text-white hover:bg-emerald-700 border-0 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push((isAssigned || isInternal) ? `/recursos/${resource.id}` : `/solicitar?resource=${resource.id}`);
                    }}
                  >
                    {(isAssigned || isInternal) ? 'Ver ficha' : 'Solicitar'}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-black/[0.04] dark:border-white/[0.04] px-5 py-3">
            <span className="text-[11px] text-gray-400 dark:text-[#555]">{filteredResources.length} recurso(s) en esta vista</span>
          </div>
        </div>
      )}
    </div>
  );
}
