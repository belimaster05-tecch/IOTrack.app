'use client'
import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Upload, Save, X, Image as ImageIcon, RefreshCw, AlertCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { uploadResourceImage } from '@/lib/storage';
import { useCategories, useLocations, useDepartments, useUsers } from '@/lib/hooks';
import type { CatalogVisibility } from '@/lib/resourceVisibility';
import { getCategoryIconComponent } from '@/lib/categoryIcons';

function NewResourceInner() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { categories, loading: categoriesLoading } = useCategories();
  const { locations, loading: locationsLoading } = useLocations();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { users } = useUsers(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(''); // This will store the UUID
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrefix, setUnitPrefix] = useState('');
  const [unitStartNumber, setUnitStartNumber] = useState('1');
  const [ownershipType, setOwnershipType] = useState('general');
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>('public');
  const [ownerName, setOwnerName] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [department, setDepartment] = useState('');
  const [resourceType, setResourceType] = useState<'reusable' | 'consumable' | 'instalado' | 'servicio'>('reusable');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editId) {
      const fetchEditResource = async () => {
        const { data, error } = await supabase
          .from('resources')
          .select('*, categories(name)')
          .eq('id', editId)
          .single();

        if (data && !error) {
          setName(data.name || '');
          setSku(data.sku || '');
          setDescription(data.description || '');
          setQuantity((data.initial_quantity || 1).toString());
          setOwnershipType(data.ownership_type || 'general');
          setCatalogVisibility((data.catalog_visibility as CatalogVisibility) || (data.ownership_type === 'personal' ? 'restricted' : data.ownership_type === 'area' ? 'restricted' : 'public'));
          setOwnerName(data.owner_name || '');
          if (data.owner_user_id) setOwnerUserId(data.owner_user_id);
          setResourceType(data.type || 'reusable');
          setRequiresApproval(data.requires_approval !== false);
          if (data.image_url) setImagePreview(data.image_url);
          if (data.category_id) setCategory(data.category_id);
          if (data.location_id) setLocationId(data.location_id);
          if (data.department_id) setDepartmentId(data.department_id);

          if (data.sku) {
            const parts = data.sku.split('-');
            if (parts.length > 1) setUnitPrefix(parts[0]);
          }
        }
      };
      fetchEditResource();
    }
  }, [editId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'El nombre del recurso es obligatorio';
    }
    if (!category) {
      newErrors.category = 'Debes seleccionar una categoría';
    }
    if (!quantity || parseInt(quantity) < 1) {
      newErrors.quantity = 'La cantidad debe ser al menos 1';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      // 1. Get Organization ID from user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.organization_id) throw new Error('No se encontró la organización del usuario');

      // 2. Create or Update Resource
      const finalSku = sku || (editId ? undefined : `${unitPrefix || 'RES'}-${Math.random().toString(36).substring(7).toUpperCase()}`);

      const resourceData = {
        name,
        sku: finalSku,
        description,
        type: resourceType,
        category_id: category || null,
        location_id: locationId || null,
        department_id: departmentId || null,
        initial_quantity: parseInt(quantity),
        ownership_type: ownershipType,
        catalog_visibility: catalogVisibility,
        owner_name: ownerName,
        owner_user_id: ownershipType === 'personal' ? (ownerUserId || null) : null,
        requires_approval: requiresApproval,
        organization_id: profile.organization_id,
        status: 'available'
      };

      let resourceId = editId;
      let existingResource = null;

      if (editId) {
        const { data, error: resError } = await supabase
          .from('resources')
          .update(resourceData)
          .eq('id', editId)
          .select()
          .single();
        if (resError) throw resError;
        existingResource = data;
      } else {
        const { data, error: resError } = await supabase
          .from('resources')
          .insert(resourceData)
          .select()
          .single();
        if (resError) throw resError;
        existingResource = data;
        resourceId = data.id;
      }

      let generatedUnitsCount = 0;
      // 4. Create Resource Units for reusable items
      if (resourceType === 'reusable' && existingResource) {
        const startNum = parseInt(unitStartNumber) || 1;
        const prefix = unitPrefix || existingResource.sku.split('-')[0] || 'ITM';

        // If editing, only generate if requested, or if quantity is increased.
        // For simplicity, if they specify a start number and prefix, we can generate `quantity` units?
        // Wait, if they are editing, `quantity` might be the total. Let's just generate the number of units specified in the input only if they explicitly change it or if creating new.
        // Actually, let's just create the missing amount if they bumped the quantity.
        const targetQuantity = parseInt(quantity);

        let unitsToGenerate = targetQuantity;
        if (editId) {
           // We need to know how many units already exist.
           const { count } = await supabase
             .from('resource_units')
             .select('*', { count: 'exact', head: true })
             .eq('resource_id', existingResource.id);

           const currentCount = count || 0;
           unitsToGenerate = Math.max(0, targetQuantity - currentCount);
        }

        if (unitsToGenerate > 0) {
          const units = Array.from({ length: unitsToGenerate }).map((_, i) => ({
            resource_id: existingResource.id,
            organization_id: profile.organization_id,
            serial_number: `${prefix}-${(startNum + i).toString().padStart(3, '0')}`,
            status: 'available',
            condition: 'new'
          }));

          const { error: unitsError } = await supabase
            .from('resource_units')
            .insert(units);

          if (unitsError) throw unitsError;
          generatedUnitsCount = unitsToGenerate;
        }

        // Update total quantity in resources table to reflect reality
        if (editId && unitsToGenerate > 0) {
           await supabase.from('resources').update({ initial_quantity: targetQuantity }).eq('id', existingResource.id);
        }
      }

      // 5. Upload Image if exists
      if (imageFile && resourceId) {
        const imageUrl = await uploadResourceImage(imageFile, profile.organization_id, resourceId);
        await supabase
          .from('resources')
          .update({ image_url: imageUrl })
          .eq('id', resourceId);
      }

      router.push('/recursos');
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation / Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div className="flex items-center text-sm text-gray-500 dark:text-[#787774]">
          <Link href="/recursos" className="hover:text-gray-900 dark:hover:text-[#E8E8E6] transition-colors">Recursos</Link>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-gray-900 dark:text-[#E8E8E6] font-medium">{editId ? 'Editar recurso' : 'Nuevo recurso'}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => router.push('/recursos')}>
            <X className="w-4 h-4 mr-2" /> Cancelar
          </Button>
          <Button
            variant="primary"
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isSubmitting ? 'Guardando...' : editId ? 'Actualizar recurso' : 'Guardar recurso'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Info */}
          <div className="bg-white dark:bg-[#242424] p-6 rounded-xl shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Información General</h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Nombre del recurso *</label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: '' });
                    }}
                    placeholder="Ej. MacBook Pro 16&quot; (M3 Max)"
                    className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.name && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Código / SKU</label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ej. TEC-2435"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-2">Categoría *</label>
                <div className="flex flex-wrap gap-2">
                  {categoriesLoading ? (
                    <div className="flex gap-2">
                      {[1, 2, 3].map(i => <div key={i} className="w-24 h-10 bg-gray-100 dark:bg-[#2A2A2A] animate-pulse rounded-xl" />)}
                    </div>
                  ) : categories.map((cat) => {
                    const Icon = getCategoryIconComponent(cat.icon_name);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategory(cat.id);
                          if (errors.category) setErrors({ ...errors, category: '' });
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                          category === cat.id
                            ? "border-gray-900 bg-gray-900 text-white shadow-md"
                            : errors.category
                              ? "border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 hover:border-red-400"
                              : "border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] text-gray-700 dark:text-[#C8C8C6] hover:border-gray-300 dark:hover:border-[#444] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:shadow-sm"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", category === cat.id ? "text-white" : errors.category ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-[#787774]")} />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                {errors.category && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{errors.category}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow min-h-[120px] resize-y placeholder:text-gray-400 dark:placeholder:text-[#555]"
                  placeholder="Describe las características principales del recurso..."
                />
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-white dark:bg-[#242424] p-6 rounded-xl shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Inventario y Valor</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Tipo de recurso</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as any)}
                    className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
                  >
                    <option value="reusable">Serie (activo con unidades numeradas)</option>
                    <option value="consumable">Consumible (stock en bulk)</option>
                    <option value="instalado">Instalado (fijo, no prestable)</option>
                    <option value="servicio">Servicio (suscripción o servicio externo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">
                    {resourceType === 'reusable' ? 'Cantidad inicial *' : 'Stock actual *'}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      if (errors.quantity) setErrors({ ...errors, quantity: '' });
                    }}
                    className={errors.quantity ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errors.quantity && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{errors.quantity}</p>}
                </div>

                {(resourceType === 'reusable') && (
                  <div className="bg-gray-50 dark:bg-[#1D1D1D] p-4 rounded-xl mt-4">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-[#E8E8E6] mb-3 flex items-center gap-2">
                      <Layers className="w-3 h-3" /> Generación de Unidades
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-[#787774] mb-3 leading-tight">
                      {editId
                        ? 'Si aumentas la cantidad, se generarán automáticamente las unidades faltantes.'
                        : 'Se generarán unidades individuales para este recurso.'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider mb-1">Prefijo ID</label>
                        <Input
                          value={unitPrefix}
                          onChange={(e) => setUnitPrefix(e.target.value.toUpperCase())}
                          placeholder="IPD, MAC, etc."
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-[#787774] uppercase tracking-wider mb-1">Inicio Num.</label>
                        <Input
                          type="number"
                          min="1"
                          value={unitStartNumber}
                          onChange={(e) => setUnitStartNumber(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {(resourceType === 'reusable') && parseInt(quantity) > 0 && (
                  <div className="bg-gray-50 dark:bg-[#1D1D1D] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-[#E8E8E6] mb-3 flex items-center gap-2">
                      <Layers className="w-3 h-3" /> Vista Previa de Nuevas Unidades
                    </h3>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                      {Array.from({ length: Math.min(parseInt(quantity), 5) }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-gray-200 dark:border-[#3A3A3A] last:border-0">
                          <span className="font-mono text-gray-600 dark:text-[#AAAAAA]">
                            {(unitPrefix || 'RES')}-{(parseInt(unitStartNumber) || 1 + i).toString().padStart(3, '0')}
                          </span>
                          <Badge variant="neutral" className="text-[9px] px-1.5 py-0">Disponible</Badge>
                        </div>
                      ))}
                      {parseInt(quantity) > 5 && (
                        <p className="text-[10px] text-gray-400 dark:text-[#555] italic text-center pt-1">+ {parseInt(quantity) - 5} unidades más...</p>
                      )}
                    </div>
                  </div>
                )}
                 {errors.submit && (
                   <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg">
                     <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errors.submit}</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Media & Organization */}
        <div className="space-y-8">
          {/* Image Upload */}
          <div className="bg-white dark:bg-[#242424] p-6 rounded-xl shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Imagen</h2>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[220px]",
                imagePreview ? "border-gray-900 bg-gray-50 dark:bg-[#1D1D1D]" : "border-gray-200 dark:border-[#3A3A3A] hover:border-gray-300 dark:hover:border-[#444] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
              )}
            >
              {imagePreview ? (
                <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-inner">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Cambiar imagen</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-gray-100 dark:bg-[#2A2A2A] rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 text-gray-500 dark:text-[#787774]" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-[#E8E8E6] mb-1">Subir imagen</p>
                  <p className="text-[10px] text-gray-400 dark:text-[#555] font-medium px-4">Arrastra o selecciona un archivo (PNG, JPG o SVG)</p>
                </>
              )}
            </div>
          </div>

          {/* Organization */}
          <div className="bg-white dark:bg-[#242424] p-6 rounded-xl shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Ubicación y Propiedad</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Tipo de Propiedad *</label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
              >
                <option value="general">General (catálogo público)</option>
                <option value="area">Por área / aula</option>
                <option value="personal">Asignado a persona</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-[#787774]">
                La propiedad describe a quién pertenece el recurso. La visibilidad de catálogo se define abajo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Visibilidad en catálogo *</label>
              <select
                value={catalogVisibility}
                onChange={(e) => setCatalogVisibility(e.target.value as CatalogVisibility)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
              >
                <option value="public">Público en catálogo</option>
                <option value="restricted">Visible por área / asignado</option>
                <option value="internal">Solo administración</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-[#787774]">
                Publico aparece para todos, restringido queda como activo asignado y solo administracion queda oculto para usuarios normales.
              </p>
            </div>

            {ownershipType === 'personal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">
                  Usuario asignado *
                </label>
                <select
                  value={ownerUserId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setOwnerUserId(uid);
                    const u = users.find((u: any) => u.id === uid);
                    setOwnerName(u?.full_name || '');
                  }}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
                >
                  <option value="">Sin asignar</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-[#787774]">
                  Solo esta persona y los administradores podrán ver el recurso.
                </p>
              </div>
            )}
            {ownershipType === 'area' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1 italic">
                  Nombre del Aula/Área o responsable *
                </label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej. Aula 3B"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Departamento (área de la organización)</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
                >
                  <option value="">Sin asignar</option>
                  {departmentsLoading ? (
                    <option disabled>Cargando...</option>
                  ) : (
                    departments.map((d: { id: string; name: string }) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-gray-400 dark:text-[#555] mt-0.5">Distinto de Categoría: aquí es el departamento que gestiona el recurso.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Ubicación de almacenamiento</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-300 dark:border-[#444] rounded-md text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow font-medium"
                >
                  <option value="">Sin asignar</option>
                  {locationsLoading ? (
                    <option disabled>Cargando...</option>
                  ) : (
                    locations.filter((loc: { is_reservable?: boolean }) => !loc.is_reservable).map((loc: { id: string; name: string }) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-gray-400 dark:text-[#555] mt-0.5">Dónde se guarda y se devuelve el recurso. Siempre visible para el usuario.</p>
              </div>
            </div>
            <div className="pt-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <span className="block text-sm font-bold text-gray-900 dark:text-[#E8E8E6] group-hover:text-black dark:group-hover:text-white transition-colors">Requiere Aprobación</span>
                  <span className="block text-[10px] text-gray-400 dark:text-[#555] font-medium mt-0.5 leading-tight pr-4">Si está desactivado, las solicitudes se aprobarán automáticamente.</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export function NewResource() {
  return <Suspense><NewResourceInner /></Suspense>
}
