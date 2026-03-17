'use client'
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  groups,
  placeholder = 'Seleccionar...',
  className,
  disabled,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allOptions = groups
    ? groups.flatMap((g) => g.options)
    : (options ?? []);

  const selected = allOptions.find((o) => o.value === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(allOptions.length * 44 + 8, 260);
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [allOptions.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    function handleScroll() { updatePosition(); }
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
  }

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className={cn(
        'bg-white dark:bg-[#242424]',
        'border border-gray-200 dark:border-[#333]',
        'rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40',
        'overflow-y-auto max-h-64',
        'animate-in fade-in-0 zoom-in-95 duration-100'
      )}
    >
      {groups
        ? groups.map((group) => (
            <div key={group.label}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#555]">
                {group.label}
              </p>
              {group.options.map((opt) => (
                <OptionRow key={opt.value} opt={opt} selected={opt.value === value} onSelect={handleSelect} />
              ))}
            </div>
          ))
        : (options ?? []).map((opt) => (
            <OptionRow key={opt.value} opt={opt} selected={opt.value === value} onSelect={handleSelect} />
          ))}
    </div>
  ) : null;

  return (
    <div className={cn('relative', className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full h-10 px-3 flex items-center justify-between gap-2',
          'bg-white dark:bg-[#1D1D1D]',
          'border border-gray-300 dark:border-[#444] rounded-md',
          'text-sm font-medium text-gray-900 dark:text-[#E8E8E6]',
          'focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6]',
          'transition-all select-none cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          !selected && 'text-gray-400 dark:text-[#555]'
        )}
      >
        <span className="truncate flex-1 text-left">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-gray-400 dark:text-[#555] transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown — rendered in portal to escape overflow containers */}
      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}

function OptionRow({
  opt,
  selected,
  onSelect,
}: {
  opt: SelectOption;
  selected: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(opt.value)}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
        'hover:bg-gray-50 dark:hover:bg-[#2A2A2A]',
        selected && 'bg-gray-50 dark:bg-[#2A2A2A]'
      )}
    >
      <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
        {selected && (
          <Check className="w-3.5 h-3.5 text-gray-900 dark:text-[#E8E8E6]" />
        )}
      </div>
      <div className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-[#E8E8E6] leading-snug">
          {opt.label}
        </span>
        {opt.description && (
          <span className="block text-xs text-gray-500 dark:text-[#787774] mt-0.5 leading-snug">
            {opt.description}
          </span>
        )}
      </div>
    </button>
  );
}
