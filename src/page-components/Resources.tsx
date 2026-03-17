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
  ChevronDown,
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
    label: 'Público',
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
    descAdmin: 'Recursos fijos instalados, asignados a personas o vinculados a áreas.',
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
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
          .map((rct: any) => rct.tag_id || rct.condition_tags?.id)
          .filter(Boolean);
        if (!selectedTagIds.some((tid) => rTagIds.includes(tid))) return false;
      }

      const visibility = getCatalogVisibility(resource);
      if (segmentFilter === 'catalogo') return visibility === 'public' && resource.behavior !== 'instalado';
      if (segmentFilter === 'asignados') return visibility === 'restricted' || resource.behavior === 'instalado' || resource.ownership_type === 'area';
      if (segmentFilter === 'internos') return isAdmin ? visibility === 'internal' : false;
      return true;
    });
  }, [visibleResources, searchQuery, selectedCategory, selectedTagIds, segmentFilter, isAdmin]);

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
    const avail = resource.available_quantity ?? 0;
    const total = resource.total_quantity ?? 0;
    const pct = total > 0 ? Math.min(100, (avail / total) * 100) : 0;
    const isFixedOrService = resource.behavior === 'instalado' || resource.behavior === 'servicio';
    const behaviorLabel = resource.behavior === 'instalado' ? 'Fijo' : resource.behavior === 'servicio' ? 'Servicio' : resource.behavior === 'gastable' ? 'Gastable' : resource.type === 'consumable' ? 'Gastable' : 'Reutilizable';
    const condTags = (resource.resource_condition_tags || []).filter((rct: any) => rct.condition_tags);

    const availColor = pct > 66 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500';
    const availDot = pct > 66 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-rose-500';

    return (
      <div
        key={resource.id}
        onClick={() => router.push(`/recursos/${resource.id}`)}
        className="group cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-200 hover:border-gray-200 hover:shadow-sm dark:bg-[#1C1C1C] dark:border-[#2A2A2A] dark:hover:border-[#383838]"
      >
        {/* Image area */}
        <div className="relative overflow-hidden bg-gray-50 dark:bg-[#141414]" style={{ height: compact ? 120 : 160 }}>
          {resource.image_url ? (
            <img
              src={resource.image_url}
              alt={resource.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-10 w-10 text-gray-200 dark:text-[#333]" />
            </div>
          )}
          {/* Behavior badge — top right */}
          <div className="absolute right-2.5 top-2.5">
            <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm dark:bg-black/60">
              {behaviorLabel}
            </span>
          </div>
          {/* Internal/assigned badge — top left */}
          {(isInternal || isAssigned) && (
            <div className="absolute left-2.5 top-2.5">
              {isInternal ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-900/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  <Shield className="h-2.5 w-2.5" /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-600/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  <UserRound className="h-2.5 w-2.5" /> Asignado
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Name + category */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-[#555] mb-0.5">
              {resource.categories?.name || 'General'}
            </p>
            <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-[#E8E8E6] line-clamp-2">
              {resource.name}
            </h3>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-[#555]">
            {resource.locations?.name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{resource.locations.name}</span>
              </span>
            )}
            {condTags.slice(0, 1).map((rct: any) => {
              const tag = rct.condition_tags;
              const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
              return (
                <span key={tag.id} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', c.bg, c.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)} />
                  {tag.name}
                </span>
              );
            })}
          </div>

          {/* Availability / assigned */}
          <div className="mt-auto">
            {isAssigned || isInternal || isFixedOrService ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#787774]">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{resource.owner_name || (isFixedOrService ? resource.locations?.name || '—' : isInternal ? 'Uso interno' : '—')}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-[#555]">Disponible</span>
                <span className={cn('text-xs font-semibold tabular-nums', availColor)}>{avail}/{total}</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(isAssigned || isInternal || isFixedOrService ? `/recursos/${resource.id}` : `/solicitar?resource=${resource.id}`);
            }}
            className={cn(
              'mt-1 w-full rounded-xl py-2.5 text-xs font-semibold transition-colors cursor-pointer',
              isAssigned || isInternal || isFixedOrService
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#2A2A2A] dark:text-[#C8C8C6] dark:hover:bg-[#333]'
                : 'bg-gray-900 text-white hover:bg-black dark:bg-[#E8E8E6] dark:text-[#111] dark:hover:bg-white'
            )}
          >
            {isAssigned || isInternal || isFixedOrService ? 'Ver ficha' : 'Solicitar'}
          </button>
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
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer',
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
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
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
                  className={cn('rounded-full p-2 transition cursor-pointer', viewMode === 'grid' ? 'bg-white text-gray-900' : 'text-white/70')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn('rounded-full p-2 transition cursor-pointer', viewMode === 'list' ? 'bg-white text-gray-900' : 'text-white/70')}
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
                    'rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer',
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
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                {featuredResources.map((resource) => renderResourceCard(resource, true))}
              </div>
            </section>
          )}

          {groupedResources.map(([groupName, items]) => {
            const isCollapsed = collapsedCategories.has(groupName);
            return (
              <section key={groupName} className="space-y-4">
                <div
                  className="flex items-end justify-between gap-4 cursor-pointer select-none"
                  onClick={() =>
                    setCollapsedCategories((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupName)) next.delete(groupName);
                      else next.add(groupName);
                      return next;
                    })
                  }
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-[#787774]">Categoría</p>
                    <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-[#E8E8E6]">{groupName}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCollapsed && (
                      <span className="text-xs text-gray-400 dark:text-[#555]">({items.length} ocultos)</span>
                    )}
                    {!isCollapsed && (
                      <p className="text-sm text-gray-500 dark:text-[#787774]">{items.length} recurso(s)</p>
                    )}
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-gray-400 dark:text-[#555] transition-transform duration-200',
                        isCollapsed && 'rotate-180'
                      )}
                    />
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                    {items.map((resource) => renderResourceCard(resource))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:bg-[#1C1C1C] dark:border-[#2A2A2A]">
          {filteredResources.map((resource, idx) => {
            const Icon = getCategoryIconComponent(resource.categories?.icon_name);
            const visibility = getCatalogVisibility(resource);
            const isAssigned = visibility === 'restricted';
            const isInternal = visibility === 'internal';
            const isFixedOrService = resource.behavior === 'instalado' || resource.behavior === 'servicio';
            const avail = resource.available_quantity ?? 0;
            const total = resource.total_quantity ?? 0;
            const pct = total > 0 ? Math.min(100, (avail / total) * 100) : 0;
            const availColor = pct > 66 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500';
            const condTags = (resource.resource_condition_tags || []).filter((rct: any) => rct.condition_tags);

            return (
              <div
                key={resource.id}
                onClick={() => router.push(`/recursos/${resource.id}`)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-[#242424]',
                  idx > 0 && 'border-t border-gray-50 dark:border-[#242424]'
                )}
              >
                {/* Thumbnail */}
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center">
                  {resource.image_url ? (
                    <img
                      src={resource.image_url}
                      alt={resource.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-300 dark:text-[#444]" />
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{resource.name}</h3>
                    {isInternal && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-[#111]">
                        <Shield className="h-2.5 w-2.5" />Admin
                      </span>
                    )}
                    {isAssigned && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-[#1E2A40] dark:text-[#A7C0FF]">
                        <UserRound className="h-2.5 w-2.5" />Asignado
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-400 dark:text-[#555]">{resource.categories?.name || 'General'}</span>
                    {resource.locations?.name && (
                      <>
                        <span className="text-gray-200 dark:text-[#333]">·</span>
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-[#555]">
                          <MapPin className="h-2.5 w-2.5" />{resource.locations.name}
                        </span>
                      </>
                    )}
                    {condTags.map((rct: any) => {
                      const tag = rct.condition_tags;
                      const c = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                      return (
                        <span key={tag.id} className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', c.bg, c.text)}>
                          <span className={cn('h-1 w-1 rounded-full shrink-0', c.dot)} />
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Availability — hidden on mobile */}
                <div className="hidden sm:block w-20 shrink-0 text-right">
                  {isAssigned || isInternal || isFixedOrService ? (
                    <span className="text-[11px] text-gray-400 dark:text-[#555]">
                      {resource.owner_name || (isFixedOrService ? 'Fijo' : '—')}
                    </span>
                  ) : (
                    <span className={cn('text-xs font-semibold tabular-nums', availColor)}>{avail}/{total}</span>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(isAssigned || isInternal || isFixedOrService ? `/recursos/${resource.id}` : `/solicitar?resource=${resource.id}`);
                  }}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    isAssigned || isInternal || isFixedOrService
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#2A2A2A] dark:text-[#AAAAAA] dark:hover:bg-[#333]'
                      : 'bg-gray-900 text-white hover:bg-black dark:bg-[#E8E8E6] dark:text-[#111] dark:hover:bg-white'
                  )}
                >
                  {isAssigned || isInternal || isFixedOrService ? 'Ver' : 'Solicitar'}
                </button>
              </div>
            );
          })}

          <div className="border-t border-gray-50 dark:border-[#242424] px-4 py-2.5">
            <span className="text-[11px] text-gray-400 dark:text-[#555]">{filteredResources.length} recurso(s)</span>
          </div>
        </div>
      )}
    </div>
  );
}
