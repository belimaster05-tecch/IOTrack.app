'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ScanLine, ArrowLeftRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#1D1D1D] border-t border-transparent z-40 flex items-center justify-around px-2 pb-safe">
      <Link
        href="/dashboard"
        className={cn(
          'flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors',
          pathname === '/dashboard' ? 'text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#787774]'
        )}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>

      <Link
        href="/recursos"
        className={cn(
          'flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors',
          pathname === '/recursos' ? 'text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#787774]'
        )}
      >
        <Package className="w-5 h-5" />
        <span className="text-[10px] font-medium">Recursos</span>
      </Link>

      <Link href="/escanear" className="relative flex flex-col items-center justify-center w-16 h-full">
        <div className="absolute -top-5 flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] shadow-md hover:bg-gray-800 dark:hover:bg-white hover:-translate-y-1 transition-all">
          <ScanLine className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-medium text-gray-400 dark:text-[#555] mt-6">Escanear</span>
      </Link>

      <Link
        href="/mis-recursos"
        className={cn(
          'flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors',
          pathname === '/mis-recursos' ? 'text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#787774]'
        )}
      >
        <ArrowLeftRight className="w-5 h-5" />
        <span className="text-[10px] font-medium">Mi uso</span>
      </Link>

      <Link
        href="/perfil"
        className={cn(
          'flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors',
          pathname === '/perfil' ? 'text-gray-900 dark:text-[#E8E8E6]' : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#787774]'
        )}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-medium">Perfil</span>
      </Link>
    </nav>
  );
}
