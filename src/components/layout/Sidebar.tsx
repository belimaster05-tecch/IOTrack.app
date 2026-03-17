'use client'
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ClipboardList, Calendar, ScanLine,
  Building2, MapPin, Users, BarChart3, Settings, Search,
  UserCircle, PlusCircle, LogOut, Sun, Moon,
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useIsDepartmentLeader } from '@/lib/hooks';
import type { OrgFeatures } from '@/lib/features';

const adminNavItems: { icon: React.ElementType; label: string; to: string; feature?: keyof OrgFeatures }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: Package, label: 'Recursos', to: '/recursos' },
  { icon: UserCircle, label: 'A mi disposición', to: '/mis-recursos' },
  { icon: ClipboardList, label: 'Gestión', to: '/solicitudes' },
  { icon: Calendar, label: 'Reservas', to: '/reservas', feature: 'reservations' },
  { icon: ScanLine, label: 'Escanear QR', to: '/escanear', feature: 'scan' },
];

const employeeNavItems: { icon: React.ElementType; label: string; to: string; feature?: keyof OrgFeatures }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: UserCircle, label: 'A mi disposición', to: '/mis-recursos' },
  { icon: PlusCircle, label: 'Solicitar Recurso', to: '/solicitar' },
  { icon: Calendar, label: 'Mis Reservas', to: '/reservas', feature: 'reservations' },
];

const managementItems: { icon: React.ElementType; label: string; to: string; feature?: keyof OrgFeatures }[] = [
  { icon: Building2, label: 'Departamentos', to: '/departamentos', feature: 'departments' },
  { icon: MapPin, label: 'Ubicaciones', to: '/ubicaciones', feature: 'locations' },
  { icon: Users, label: 'Usuarios', to: '/usuarios' },
  { icon: BarChart3, label: 'Reportes', to: '/reportes', feature: 'reports' },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

function NavItem({ icon: Icon, label, to, onClick }: { icon: React.ElementType; label: string; to: string; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === to;
  return (
    <Link
      href={to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 px-3 h-8 rounded-lg text-sm transition-all duration-150',
        isActive
          ? 'bg-gray-900 text-white font-medium dark:bg-[#E8E8E6] dark:text-[#191919]'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-[#787774] dark:hover:bg-[#2A2A2A] dark:hover:text-[#E8E8E6]'
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80')} />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { role } = useRole();
  const { user, profile, signOut, organizationLogoUrl } = useAuth();
  const { theme, toggle } = useTheme();
  const { features } = useFeatures();
  const orgName = profile?.organizations?.name ?? 'InvTrack';
  const isDepartmentLeader = useIsDepartmentLeader(user?.id);
  const canAccessGestion = role === 'admin' || role === 'approver' || isDepartmentLeader;
  const router = useRouter();
  const pathname = usePathname();
  const allNavItems = canAccessGestion ? adminNavItems : employeeNavItems;
  const navItems = allNavItems.filter((n) => !n.feature || features[n.feature]);
  const visibleManagementItems = managementItems.filter((n) => !n.feature || features[n.feature]);

  const roleLabel =
    role === 'admin' ? 'Administrador'
    : role === 'approver' ? 'Aprobador'
    : isDepartmentLeader ? 'Encargado'
    : 'Empleado';

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 xl:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'flex flex-col w-[260px] h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out xl:translate-x-0',
        'bg-white',
        'dark:bg-[#1D1D1D]',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Logo */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2.5 px-1 mb-5">
            {organizationLogoUrl ? (
              <div className="h-7 max-w-[96px] rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-[#333] bg-white dark:bg-[#111] flex items-center justify-center px-1">
                <Image
                  src={organizationLogoUrl}
                  alt={orgName}
                  width={96}
                  height={28}
                  className="h-6 w-auto object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs tracking-tight">
                  {orgName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm text-gray-900 dark:text-[#E8E8E6] leading-tight truncate">{orgName}</h2>
              <p className="text-[10px] text-gray-400 dark:text-[#555] tracking-wide">IOTrack · {roleLabel}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 dark:text-[#555]" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-50 border border-gray-100 dark:bg-[#252525] dark:border-[#333] dark:text-[#C8C8C6] dark:placeholder-[#555] focus:border-gray-200 dark:focus:border-[#444] focus:bg-white dark:focus:bg-[#2A2A2A] focus:outline-none text-xs transition-all cursor-text"
            />
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {(
            <>
              <motion.div variants={container} initial="hidden" animate="show">
                <p className="px-3 text-[10px] font-semibold text-gray-300 dark:text-[#444] uppercase tracking-widest mb-1.5">Principal</p>
                <nav className="space-y-0.5">
                  {navItems.map((navItem) => (
                    <motion.div key={navItem.to} variants={item}>
                      <NavItem {...navItem} onClick={onClose} />
                    </motion.div>
                  ))}
                </nav>
              </motion.div>

              {canAccessGestion && visibleManagementItems.length > 0 && (
                <motion.div variants={container} initial="hidden" animate="show">
                  <p className="px-3 text-[10px] font-semibold text-gray-300 dark:text-[#444] uppercase tracking-widest mb-1.5">Administración</p>
                  <nav className="space-y-0.5">
                    {visibleManagementItems.map((navItem) => (
                      <motion.div key={navItem.to} variants={item}>
                        <NavItem {...navItem} onClick={onClose} />
                      </motion.div>
                    ))}
                  </nav>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 space-y-1">
          <Link
            href="/configuracion"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs transition-colors',
              pathname === '/configuracion'
                ? 'bg-gray-900 text-white dark:bg-[#E8E8E6] dark:text-[#191919] font-medium'
                : 'text-gray-400 dark:text-[#787774] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] hover:text-gray-700 dark:hover:text-[#E8E8E6]'
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configuración</span>
          </Link>

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs text-gray-400 dark:text-[#787774] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] hover:text-gray-700 dark:hover:text-[#E8E8E6] transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="w-3.5 h-3.5" />
              : <Moon className="w-3.5 h-3.5" />
            }
            <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs text-gray-400 dark:text-[#787774] hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>

          {/* User card */}
          <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#252525]">
            <Image
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || user?.user_metadata?.full_name || 'U')}&background=059669&color=fff&size=64`}
              alt="User"
              width={28}
              height={28}
              className="w-7 h-7 rounded-full shrink-0 object-cover"
              unoptimized
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-[#E8E8E6] truncate leading-tight">
                {profile?.full_name || user?.user_metadata?.full_name || 'Usuario'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-[#555] truncate">{user?.email}</p>
            </div>
            <div className="shrink-0">
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
