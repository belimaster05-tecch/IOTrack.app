'use client'
import { Search, Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-16 bg-white dark:bg-[#1D1D1D] border-b border-transparent xl:hidden transition-colors duration-200">
      <div className="flex items-center gap-3">
        <Button variant="icon" size="icon" className="xl:hidden -ml-2" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 dark:bg-[#E8E8E6] flex items-center justify-center">
            <span className="text-white dark:text-[#191919] font-bold text-xs">IT</span>
          </div>
          <h1 className="font-semibold text-sm text-gray-900 dark:text-[#E8E8E6]">InvTrack</h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="icon" size="icon">
          <Search className="w-5 h-5" />
        </Button>
        <Button variant="icon" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-[#1D1D1D]" />
        </Button>
      </div>
    </header>
  );
}
