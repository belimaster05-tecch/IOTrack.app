import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'soft' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]',
          {
            // primary
            'bg-gray-900 text-white shadow-xs hover:bg-gray-800 dark:bg-[#E8E8E6] dark:text-[#191919] dark:hover:bg-white': variant === 'primary',
            // secondary
            'bg-white text-gray-700 border border-gray-200 shadow-xs hover:bg-gray-50 hover:text-gray-900 dark:bg-[#2A2A2A] dark:text-[#C8C8C6] dark:border-[#3A3A3A] dark:hover:bg-[#333] dark:hover:text-[#E8E8E6]': variant === 'secondary',
            // destructive
            'bg-red-500 text-white shadow-xs hover:bg-red-600': variant === 'destructive',
            // ghost
            'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-[#787774] dark:hover:bg-[#2A2A2A] dark:hover:text-[#E8E8E6]': variant === 'ghost',
            // soft
            'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-[#2A2A2A] dark:text-[#E8E8E6] dark:hover:bg-[#333]': variant === 'soft',
            // icon
            'bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-900 dark:hover:bg-[#2A2A2A] dark:text-[#787774] dark:hover:text-[#E8E8E6]': variant === 'icon',
            // sizes
            'h-7 px-2.5 text-xs gap-1': size === 'sm',
            'h-9 px-4 text-sm gap-1.5': size === 'md',
            'h-10 px-5 text-sm gap-2': size === 'lg',
            'h-8 w-8': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
