'use client'
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEEEED] dark:bg-[#191919] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-gray-200 dark:border-[#333] border-t-gray-900 dark:border-t-[#E8E8E6] rounded-full animate-spin" />
          <p className="text-sm text-gray-400 dark:text-[#555] font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="min-h-screen bg-white dark:bg-[#1D1D1D] flex flex-col xl:flex-row transition-colors duration-200">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col xl:pl-[260px] pb-16 xl:pb-0">
          <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 xl:pl-3 xl:pr-0 xl:py-3">
            <div className="h-full w-full bg-[#EEEEED] dark:bg-[#191919] xl:rounded-l-[32px] overflow-hidden transition-colors duration-200">
              <div className="w-full max-w-7xl mx-auto p-4 md:p-6 xl:p-8">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </AuthGate>
  );
}
