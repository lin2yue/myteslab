'use client';

import { Check, Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeMode, useThemeMode } from '@/utils/theme';

const options: { value: ThemeMode; label: string; icon: ReactNode }[] = [
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
    { value: 'light', label: 'Light', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
];

export default function ThemeToggle() {
    const { mounted, mode, effective, setMode } = useThemeMode();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!mounted) {
        return <div className="w-9 h-9" />;
    }

    const buttonIcon = mode === 'system'
        ? <Monitor size={18} />
        : effective === 'dark'
            ? <Moon size={18} />
            : <Sun size={18} />;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Theme"
            >
                {buttonIcon}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white/90 dark:bg-zinc-900/90 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.18)] py-1 ring-1 ring-black/5 dark:ring-white/10 z-[100] backdrop-blur">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                setMode(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${mode === option.value
                                ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white font-medium'
                                : 'text-gray-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                                }`}
                        >
                            <span className="text-xs opacity-80">{option.icon}</span>
                            <span className="flex-1">{option.label}</span>
                            {mode === option.value && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
