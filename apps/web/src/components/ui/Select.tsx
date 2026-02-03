'use client'

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export default function Select({
  value,
  options,
  onChange,
  placeholder,
  className,
  buttonClassName,
  menuClassName,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const activeOption = options.find((opt) => opt.value === value);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'select-field h-12 text-left flex items-center justify-between gap-2',
          buttonClassName
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', !activeOption && 'text-gray-400')}>
          {activeOption?.label || placeholder || 'Select'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-50 mt-2 w-full rounded-xl border border-black/5 dark:border-white/10 bg-white/90 dark:bg-zinc-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur',
            menuClassName
          )}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  role="option"
                  aria-selected={isActive}
                  disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm flex items-center justify-between gap-2 transition-colors',
                    isActive
                      ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10',
                    opt.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isActive && <Check className="w-4 h-4 text-gray-600 dark:text-zinc-200" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
