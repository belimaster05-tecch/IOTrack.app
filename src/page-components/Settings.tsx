'use client'
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Save, Bell, Shield, Globe, Mail, Key, UserCircle2, Tags, Plus, Trash2, Edit2, X, RefreshCw, ChevronDown, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useCategories, useDepartments, useLocations, useResources, useConditionTags } from '@/lib/hooks';
import { TAG_COLORS, TAG_COLOR_KEYS } from '@/lib/conditionTags';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { CATEGORY_ICON_LIST, getCategoryIconComponent } from '@/lib/categoryIcons';
import { cn } from '@/lib/utils';

export function Settings() {
  const { user, refreshAuthState, organizationId } = useAuth();
  const { role } = useRole();
  const { features, updateFeature } = useFeatures();
  const isAdmin = role === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { categories, loading: loadingCategories, refetchCategories } = useCategories();
  const { departments, loading: loadingDepartments, refetchDepartments } = useDepartments();
  const { locations } = useLocations();
  const { resources } = useResources();
  const { tags: conditionTags, loading: loadingTags, refetch: refetchTags } = useConditionTags();

  // Settings state
  const [profileData, setProfileData] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if(!user) return;
    const loadData = async () => {
      const { data } = await supabase.from('profiles').select('*, organizations(name, logo_url, website)').eq('id', user.id).single();
      if(data) {
        setProfileData(data);
        setFullName(data.full_name || user.user_metadata?.full_name || '');
        if(data.organizations) {
          setOrgData(data.organizations);
          setOrgName((data.organizations as any).name || '');
          setOrgLogoUrl((data.organizations as any).logo_url ?? null);
          setOrgWebsite((data.organizations as any).website || '');
        }
      }
    };
    loadData();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB.');
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `profiles/${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('Avatar').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('Avatar').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await refreshAuthState();
      toast.success('Foto de perfil actualizada');
    } catch (err: any) {
      toast.error('Error al subir la foto: ' + err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB.');
      return;
    }
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `orgs/${organizationId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('Avatar').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('Avatar').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from('organizations').update({ logo_url: publicUrl }).eq('id', organizationId);
      if (updateError) throw updateError;
      setOrgLogoUrl(publicUrl);
      await refreshAuthState();
      toast.success('Logo actualizado');
    } catch (err: any) {
      toast.error('Error al subir el logo: ' + err.message);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!organizationId) return;
    try {
      const { error } = await supabase.from('organizations').update({ logo_url: null }).eq('id', organizationId);
      if (error) throw error;
      setOrgLogoUrl(null);
      await refreshAuthState();
      toast.success('Logo eliminado');
    } catch (err: any) {
      toast.error('Error al eliminar el logo: ' + err.message);
    }
  };

  const handleGlobalSave = async () => {
    if(!user) return;
    setSavingGlobal(true);
    try {
      if(activeTab === 'general' && profileData?.organization_id) {
         const { error } = await supabase.from('organizations').update({ name: orgName, website: orgWebsite || null }).eq('id', profileData.organization_id);
         if(error) throw error;
         toast.success('Configuración general guardada correctamente.');
      }
      else if(activeTab === 'profile') {
         const { error } = await supabase.from('profiles').update({full_name: fullName}).eq('id', user.id);
         if(error) throw error;
         toast.success('Perfil actualizado con éxito.');
      }
      else if (activeTab === 'notifications' || activeTab === 'security') {
         toast.success('Preferencias guardadas.');
      } else {
         toast.info('No hay cambios pendientes para esta pestaña.');
      }
    } catch(err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSavingGlobal(false);
    }
  };


  // Modals state
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState<string>('package');
  const [showCatIconPicker, setShowCatIconPicker] = useState(false);
  const [submittingCat, setSubmittingCat] = useState(false);

  // Inline edit state for categories
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [editingCatIcon, setEditingCatIcon] = useState<string>('package');
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);

  const handleSaveCategory = async () => {
    if (!catName.trim() || !user) return;
    try {
      setSubmittingCat(true);
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) throw new Error("No organization_id");

      const { error } = await supabase.from('categories').insert([
        { name: catName, description: catDesc, icon_name: catIcon, organization_id: profile.organization_id }
      ]);
      if (error) throw error;

      setShowCatModal(false);
      setCatName('');
      setCatDesc('');
      setCatIcon('package');
      refetchCategories();
    } catch (err: any) {
      toast.error('Error al guardar categoría: ' + err.message);
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleSaveDepartment = async () => {
    if (!deptName.trim() || !user) return;
    try {
      setSubmittingDept(true);
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) throw new Error("No organization_id");

      const { error } = await supabase.from('departments').insert([
        { name: deptName, organization_id: profile.organization_id }
      ]);
      if (error) throw error;

      setShowDeptModal(false);
      setDeptName('');
      refetchDepartments();
    } catch (err: any) {
      toast.error('Error al guardar departamento: ' + err.message);
    } finally {
      setSubmittingDept(false);
    }
  };

  const startEditCat = (cat: any) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatDesc(cat.description || '');
    setEditingCatIcon(cat.icon_name || 'package');
    setShowEditIconPicker(false);
  };

  const handleUpdateCategory = async () => {
    if (!editingCatId || !editingCatName.trim()) return;
    setSavingCat(true);
    try {
      const { error } = await supabase.from('categories').update({ name: editingCatName.trim(), description: editingCatDesc.trim() || null, icon_name: editingCatIcon }).eq('id', editingCatId);
      if (error) throw error;
      setEditingCatId(null);
      refetchCategories();
    } catch (err: any) {
      toast.error('Error al actualizar: ' + err.message);
    } finally {
      setSavingCat(false);
    }
  };

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  const handleDeleteCategory = async (id: string) => {
    setDeletingCatId(id);
    setCatError(null);
    try {
      // Nullify resources that reference this category first (handles FK if not ON DELETE SET NULL)
      await supabase.from('resources').update({ category_id: null }).eq('category_id', id);
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) {
        if (error.code === '42501' || error.message?.includes('policy')) {
          setCatError('Sin permiso para eliminar. Añade una política DELETE en el dashboard de Supabase.');
        } else if (error.code === '23503') {
          setCatError('Esta categoría tiene recursos asignados. Desvincula los recursos primero.');
        } else {
          setCatError(error.message);
        }
      } else {
        refetchCategories();
      }
    } finally {
      setDeletingCatId(null);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if(!window.confirm("¿Estás seguro de eliminar este departamento?")) return;
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) toast.error('Error al eliminar: ' + error.message);
    else refetchDepartments();
  };

  // Condition Tags state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('gray');
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('gray');
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !user) return;
    setSavingTag(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) throw new Error('Sin organización');
      const { error } = await supabase.from('condition_tags').insert({ name: newTagName.trim(), color: newTagColor, organization_id: profile.organization_id });
      if (error) throw error;
      setNewTagName('');
      setNewTagColor('gray');
      setAddingTag(false);
      refetchTags();
      toast.success('Etiqueta creada');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingTag(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTagId || !editingTagName.trim()) return;
    setSavingTag(true);
    try {
      const { error } = await supabase.from('condition_tags').update({ name: editingTagName.trim(), color: editingTagColor }).eq('id', editingTagId);
      if (error) throw error;
      setEditingTagId(null);
      refetchTags();
      toast.success('Etiqueta actualizada');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm('¿Eliminar esta etiqueta? Se quitará de todos los recursos que la usen.')) return;
    setDeletingTagId(id);
    try {
      await supabase.from('resource_condition_tags').delete().eq('tag_id', id);
      const { error } = await supabase.from('condition_tags').delete().eq('id', id);
      if (error) throw error;
      refetchTags();
      toast.success('Etiqueta eliminada');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setDeletingTagId(null);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('La contraseña debe incluir al menos un número.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (

    <div className="space-y-8 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Configuración</h1>
          <p className="text-gray-500 dark:text-[#787774] mt-2 text-sm">Administra las preferencias y ajustes del sistema.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" className="bg-black text-white hover:bg-gray-800" onClick={handleGlobalSave} disabled={savingGlobal}>
            {savingGlobal ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Cambios
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* SIDEBAR NAV */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-[#E8E8E6]'}`}
            >
              <Globe className="w-4 h-4" /> General
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-[#E8E8E6]'}`}
            >
              <Bell className="w-4 h-4" /> Notificaciones
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-[#E8E8E6]'}`}
            >
              <Shield className="w-4 h-4" /> Seguridad
            </button>
            <button
              onClick={() => setActiveTab('catalogs')}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'catalogs' ? 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-[#E8E8E6]'}`}
            >
              <Tags className="w-4 h-4" /> Catálogos
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-[#E8E8E6]'}`}
            >
              <UserCircle2 className="w-4 h-4" /> Mi Perfil
            </button>
          </nav>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 space-y-6">
          {activeTab === 'catalogs' && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Recursos restringidos</p>
                    <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                      {resources.filter((resource: any) => resource.catalog_visibility === 'restricted').length}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Asignados para uso de un departamento</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Ubicaciones de almacenamiento</p>
                    <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                      {locations.filter((loc: any) => !loc.is_reservable).length}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Puntos donde viven o se devuelven recursos</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1D1D1D] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-[#555]">Espacios de uso</p>
                    <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                      {locations.filter((loc: any) => loc.is_reservable).length}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">Laboratorios, canchas, aulas o salas</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => window.location.assign('/departamentos')}>
                    Ver departamentos
                  </Button>
                  <Button variant="secondary" className="bg-white dark:bg-[#242424]" onClick={() => window.location.assign('/ubicaciones')}>
                    Ver ubicaciones
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Categorías de Recursos</h3>
                    <p className="text-sm text-gray-500 dark:text-[#787774]">Administra las categorías para clasificar el inventario.</p>
                  </div>
                  <Button variant="secondary" className="bg-white dark:bg-[#242424] text-sm h-9" onClick={() => setShowCatModal(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Nueva Categoría
                  </Button>
                </div>
                {catError && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-900/30 dark:bg-red-950/20">
                    <p className="text-sm text-red-700 dark:text-red-400">{catError}</p>
                    <button onClick={() => setCatError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <div className="border border-gray-200 dark:border-[#3A3A3A] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-[#1D1D1D] text-gray-600 dark:text-[#AAAAAA] font-medium border-b border-gray-200 dark:border-[#3A3A3A]">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#3A3A3A] bg-white dark:bg-[#242424]">
                      {loadingCategories ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">Cargando categorías...</td></tr>
                      ) : categories.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">No hay categorías.</td></tr>
                      ) : (
                        categories.map((cat) =>
                          editingCatId === cat.id ? (
                            <tr key={cat.id} className="bg-emerald-50/50 dark:bg-emerald-900/10">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setShowEditIconPicker(!showEditIconPicker)}
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#1D1D1D] hover:border-emerald-400 transition-colors"
                                    >
                                      {(() => { const I = getCategoryIconComponent(editingCatIcon); return <I className="w-4 h-4 text-gray-500" />; })()}
                                    </button>
                                    {showEditIconPicker && (
                                      <div className="absolute left-0 top-10 z-50 w-80 rounded-2xl border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] p-3 shadow-xl">
                                        <div className="max-h-56 overflow-y-auto">
                                          <div className="grid grid-cols-10 gap-1">
                                            {CATEGORY_ICON_LIST.map(({ name, label, Icon }) => (
                                              <button
                                                key={name}
                                                type="button"
                                                title={label}
                                                onClick={() => { setEditingCatIcon(name); setShowEditIconPicker(false); }}
                                                className={cn('flex h-8 w-full items-center justify-center rounded-lg transition-colors', editingCatIcon === name ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500 dark:text-[#787774]')}
                                              >
                                                <Icon className="w-4 h-4" />
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    autoFocus
                                    value={editingCatName}
                                    onChange={(e) => setEditingCatName(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#1D1D1D] px-3 py-1.5 text-sm text-gray-900 dark:text-[#E8E8E6] outline-none focus:ring-2 focus:ring-emerald-500/40"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  value={editingCatDesc}
                                  onChange={(e) => setEditingCatDesc(e.target.value)}
                                  placeholder="Descripción opcional"
                                  className="w-full rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#1D1D1D] px-3 py-1.5 text-sm text-gray-500 dark:text-[#787774] outline-none focus:ring-2 focus:ring-emerald-500/40"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={handleUpdateCategory}
                                    disabled={savingCat}
                                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                  >
                                    {savingCat ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    onClick={() => setEditingCatId(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-[#E8E8E6] rounded-md hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                          <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-[#E8E8E6]">
                              <div className="flex items-center gap-2.5">
                                {(() => { const I = getCategoryIconComponent(cat.icon_name); return <I className="w-4 h-4 text-gray-400 dark:text-[#555] shrink-0" />; })()}
                                {cat.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-[#787774]">{cat.description || <span className="text-gray-300 dark:text-[#444]">Sin descripción</span>}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => startEditCat(cat)} className="p-1.5 text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6] rounded-md hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteCategory(cat.id)} disabled={deletingCatId === cat.id} className="p-1.5 text-gray-400 dark:text-[#555] hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40">
                                  {deletingCatId === cat.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Departamentos</h3>
                    <p className="text-sm text-gray-500 dark:text-[#787774]">Gestiona áreas, sus encargados y la lógica de recursos restringidos por departamento.</p>
                  </div>
                  <Button variant="secondary" className="bg-white dark:bg-[#242424] text-sm h-9" onClick={() => setShowDeptModal(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Departamento
                  </Button>
                </div>
                <div className="border border-gray-200 dark:border-[#3A3A3A] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-[#1D1D1D] text-gray-600 dark:text-[#AAAAAA] font-medium border-b border-gray-200 dark:border-[#3A3A3A]">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#3A3A3A] bg-white dark:bg-[#242424]">
                      {loadingDepartments ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">Cargando departamentos...</td></tr>
                      ) : departments.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">No hay departamentos.</td></tr>
                      ) : (
                        departments.map((dept) => (
                          <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-[#E8E8E6]">{dept.name}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button className="p-1.5 text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6] rounded-md hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteDepartment(dept.id)} className="p-1.5 text-gray-400 dark:text-[#555] hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Ubicaciones</h3>
                    <p className="text-sm text-gray-500 dark:text-[#787774]">Distingue entre bodegas/almacenes y espacios de uso o reserva.</p>
                  </div>
                  <Button variant="secondary" className="bg-white dark:bg-[#242424] text-sm h-9" onClick={() => window.location.assign('/ubicaciones')}>
                    Administrar ubicaciones
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-[#3A3A3A] p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Almacenamiento</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                      Donde se guardan recursos y donde deben devolverse.
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                      {locations.filter((loc: any) => !loc.is_reservable).length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-[#3A3A3A] p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Espacios de uso</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                      Laboratorios, canchas, aulas y salas que se usan o reservan.
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-[#E8E8E6]">
                      {locations.filter((loc: any) => loc.is_reservable).length}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Condition Tags */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Etiquetas de Estado</h3>
                    <p className="text-sm text-gray-500 dark:text-[#787774]">Etiquetas para clasificar el estado o condición de los recursos.</p>
                  </div>
                  {!addingTag && (
                    <Button variant="secondary" className="bg-white dark:bg-[#242424] text-sm h-9" onClick={() => setAddingTag(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Nueva Etiqueta
                    </Button>
                  )}
                </div>

                {addingTag && (
                  <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Nueva etiqueta</p>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      placeholder="Nombre de la etiqueta"
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-sm text-gray-900 dark:text-[#E8E8E6] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[#787774] mb-2">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLOR_KEYS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewTagColor(c)}
                            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2', TAG_COLORS[c].bg, TAG_COLORS[c].text, newTagColor === c ? 'border-current' : 'border-transparent')}
                          >
                            <span className={cn('w-2 h-2 rounded-full', TAG_COLORS[c].dot)} />
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" className="h-8 text-sm" onClick={handleCreateTag} disabled={savingTag || !newTagName.trim()}>
                        {savingTag ? 'Guardando…' : 'Crear'}
                      </Button>
                      <Button variant="secondary" className="h-8 text-sm bg-white dark:bg-[#242424]" onClick={() => { setAddingTag(false); setNewTagName(''); setNewTagColor('gray'); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 dark:border-[#3A3A3A] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-[#1D1D1D] text-gray-600 dark:text-[#AAAAAA] font-medium border-b border-gray-200 dark:border-[#3A3A3A]">
                      <tr>
                        <th className="px-4 py-3">Etiqueta</th>
                        <th className="px-4 py-3">Color</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#3A3A3A] bg-white dark:bg-[#242424]">
                      {loadingTags ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">Cargando…</td></tr>
                      ) : conditionTags.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-[#787774]">No hay etiquetas. Crea la primera.</td></tr>
                      ) : conditionTags.map(tag =>
                        editingTagId === tag.id ? (
                          <tr key={tag.id} className="bg-emerald-50/50 dark:bg-emerald-900/10">
                            <td className="px-4 py-2.5">
                              <input
                                type="text"
                                value={editingTagName}
                                onChange={e => setEditingTagName(e.target.value)}
                                autoFocus
                                className="w-full px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#2A2A2A] text-sm text-gray-900 dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {TAG_COLOR_KEYS.map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditingTagColor(c)}
                                    title={c}
                                    className={cn('w-5 h-5 rounded-full border-2 transition-all', TAG_COLORS[c].dot, editingTagColor === c ? 'border-gray-700 dark:border-white scale-110' : 'border-transparent')}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={handleUpdateTag}
                                  disabled={savingTag}
                                  className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                  {savingTag ? '…' : 'Guardar'}
                                </button>
                                <button onClick={() => setEditingTagId(null)} className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors cursor-pointer">
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', TAG_COLORS[tag.color]?.bg ?? 'bg-gray-100 dark:bg-gray-800', TAG_COLORS[tag.color]?.text ?? 'text-gray-600')}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', TAG_COLORS[tag.color]?.dot ?? 'bg-gray-400')} />
                                {tag.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-[#787774] capitalize">{tag.color}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); setEditingTagColor(tag.color); }}
                                  className="p-1.5 text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6] rounded-md hover:bg-gray-100 dark:hover:bg-[#333] transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.id)}
                                  disabled={deletingTagId === tag.id}
                                  className="p-1.5 text-gray-400 dark:text-[#555] hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'general' && (
            <Card className="p-6 space-y-8">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6] mb-4">Información de la Empresa</h3>
                <div className="space-y-4">
                  {/* Logo de la organización */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">
                      Logo de la organización
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-[#333] hover:border-gray-400 dark:hover:border-[#555] transition-colors group flex items-center justify-center bg-gray-50 dark:bg-[#252525]"
                      >
                        {orgLogoUrl ? (
                          <>
                            <Image src={orgLogoUrl} alt="Logo" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-white text-[10px] font-bold">Cambiar</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Building2 className="w-5 h-5 text-gray-300 dark:text-[#444]" />
                            <span className="text-[9px] text-gray-400 dark:text-[#555]">Subir</span>
                          </div>
                        )}
                        {logoUploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                      </button>
                      <div className="text-xs text-gray-400 dark:text-[#555] space-y-1">
                        <p>PNG, JPG o SVG. Máximo 2MB.</p>
                        <p>Recomendado: 128×128px o mayor.</p>
                        {orgLogoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-red-500 hover:text-red-600 dark:text-red-400 font-medium"
                          >
                            Eliminar logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Nombre de la Empresa</label>
                      <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ej. TechCorp Inc." className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-[#555]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Sitio Web</label>
                      <input type="url" value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} placeholder="https://miempresa.com" className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-[#555]" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'general' && isAdmin && (
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Características</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#787774]">
                  Activa o desactiva módulos para todos los miembros de la organización.
                </p>
              </div>
              <div className="space-y-3">
                {([
                  { key: 'reservations', label: 'Reservas', description: 'Módulo para reservar espacios y recursos con calendario.' },
                  { key: 'scan', label: 'Escaneo QR', description: 'Check-in y check-out de recursos mediante código QR.' },
                  { key: 'reports', label: 'Reportes y analíticas', description: 'Dashboards e informes de uso del inventario.' },
                  { key: 'locations', label: 'Ubicaciones', description: 'Gestión de laboratorios, aulas y espacios físicos.' },
                  { key: 'departments', label: 'Departamentos', description: 'Organización de usuarios por departamento o área.' },
                ] as const).map(({ key, label, description }) => (
                  <div key={key} className="flex items-start justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-[#1D1D1D]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-[#787774] mt-0.5">{description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={features[key]}
                      onClick={async () => {
                        try {
                          await updateFeature(key, !features[key]);
                          toast.success(`${label} ${!features[key] ? 'activado' : 'desactivado'}.`);
                        } catch {
                          toast.error('No se pudo actualizar la característica.');
                        }
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                        features[key] ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-[#3A3A3A]'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                          features[key] ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6] mb-4">Preferencias de Notificación</h3>

              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-[#1D1D1D] rounded-xl">
                  <div className="flex gap-3">
                    <Mail className="w-5 h-5 text-gray-500 dark:text-[#787774] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Notificaciones por Email</p>
                      <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">Recibe alertas sobre préstamos vencidos y nuevas solicitudes.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="p-6 space-y-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Seguridad y Acceso</h3>

              {/* Password Change Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Cambiar Contraseña</h4>
                </div>
                <div className="h-px bg-gray-100 dark:bg-[#2A2A2A]" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Contraseña actual</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-[#444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres, una mayúscula y un número"
                      className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-[#444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-[#444]"
                    />
                  </div>
                  <div className="pt-1">
                    <Button
                      variant="primary"
                      className="bg-black text-white hover:bg-gray-800"
                      onClick={handlePasswordChange}
                      disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {passwordLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      Actualizar contraseña
                    </Button>
                  </div>
                </div>
              </div>

              {/* 2FA Coming Soon */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-gray-500 dark:text-[#787774]" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6]">Autenticación de dos factores</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 tracking-wide">
                    Próximamente
                  </span>
                </div>
                <div className="h-px bg-gray-100 dark:bg-[#2A2A2A]" />
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-[#1D1D1D]">
                  <Shield className="w-5 h-5 text-gray-400 dark:text-[#555] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Añade una capa extra de seguridad</p>
                    <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">La autenticación de dos factores (2FA) protegerá tu cuenta con un segundo método de verificación. Esta función estará disponible próximamente.</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'profile' && (
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6] mb-4">Mi Perfil</h3>

              <div className="flex items-center gap-6 mb-6">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full overflow-hidden border border-gray-200 dark:border-[#3A3A3A] group"
                >
                  <Image src={profileData?.avatar_url || "https://i.pravatar.cc/150?u=admin"} alt="Profile" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {!avatarUploading && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-[10px] font-bold">Cambiar</span>
                    </div>
                  )}
                </button>
                <div>
                  <Button variant="secondary" className="bg-white dark:bg-[#242424] mb-2" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
                    {avatarUploading ? 'Subiendo...' : 'Cambiar Foto'}
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-[#787774]">JPG, GIF o PNG. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Nombre Completo</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej. Juan Pérez" className="w-full px-3 py-2 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-[#555]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-[#C8C8C6]">Correo Electrónico</label>
                  <input type="email" defaultValue={user?.email || ""} disabled className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-lg text-sm dark:text-[#787774] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent cursor-not-allowed" />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E8E8E6]">Nueva Categoría</h3>
              <button onClick={() => { setShowCatModal(false); setShowCatIconPicker(false); }} className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-2">Ícono</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCatIconPicker(!showCatIconPicker)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#1D1D1D] px-3 py-2.5 text-sm text-gray-700 dark:text-[#C8C8C6] hover:border-gray-300 dark:hover:border-[#555] transition-colors"
                  >
                    {(() => { const I = getCategoryIconComponent(catIcon); return <I className="w-4 h-4 text-gray-500 shrink-0" />; })()}
                    <span className="flex-1 text-left">{CATEGORY_ICON_LIST.find(i => i.name === catIcon)?.label || 'Seleccionar ícono'}</span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showCatIconPicker && 'rotate-180')} />
                  </button>
                  {showCatIconPicker && (
                    <div className="absolute left-0 top-12 z-50 w-80 rounded-2xl border border-gray-200 dark:border-[#3A3A3A] bg-white dark:bg-[#242424] p-3 shadow-xl">
                      <div className="max-h-56 overflow-y-auto">
                        <div className="grid grid-cols-10 gap-1">
                          {CATEGORY_ICON_LIST.map(({ name, label, Icon }) => (
                            <button
                              key={name}
                              type="button"
                              title={label}
                              onClick={() => { setCatIcon(name); setShowCatIconPicker(false); }}
                              className={cn('flex h-8 w-full items-center justify-center rounded-lg transition-colors', catIcon === name ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500 dark:text-[#787774]')}
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Nombre *</label>
                <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ej. Laboratorio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#C8C8C6] mb-1">Descripción</label>
                <Input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Opcional" />
              </div>
              <Button onClick={handleSaveCategory} disabled={submittingCat} className="w-full bg-black text-white hover:bg-gray-800">
                {submittingCat ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Categoría
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nuevo Departamento</h3>
              <button onClick={() => setShowDeptModal(false)} className="text-gray-400 dark:text-[#555] hover:text-gray-900 dark:hover:text-[#E8E8E6]"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <Input value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="Ej. TI" />
              </div>
              <Button onClick={handleSaveDepartment} disabled={submittingDept} className="w-full bg-black text-white hover:bg-gray-800">
                {submittingDept ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Departamento
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
