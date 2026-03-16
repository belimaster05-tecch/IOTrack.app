import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'pending' | 'primary' | 'warm';
  shape?: 'pill' | 'rect';
}

function Badge({ className, variant = 'neutral', shape = 'pill', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center font-medium transition-colors border',
        {
          'px-2.5 py-0.5 text-xs rounded-full': shape === 'pill',
          'px-2 py-0.5 text-xs rounded-md': shape === 'rect',
          'bg-success-50 text-success-700 border-success-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40': variant === 'success',
          'bg-info-50 text-info-700 border-info-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40': variant === 'info',
          'bg-warning-50 text-warning-700 border-warning-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40': variant === 'warning',
          'bg-error-50 text-error-700 border-error-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40': variant === 'error',
          'bg-gray-50 text-gray-700 border-gray-200 dark:bg-[#2A2A2A] dark:text-[#C8C8C6] dark:border-[#3A3A3A]': variant === 'neutral',
          'bg-gray-100 text-gray-800 border-gray-300 dark:bg-[#333] dark:text-[#D0D0CE] dark:border-[#444]': variant === 'pending' || variant === 'warm',
          'bg-gray-900 text-white border-gray-900 dark:bg-[#E8E8E6] dark:text-[#191919] dark:border-[#E8E8E6]': variant === 'primary',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
