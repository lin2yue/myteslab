import { useEffect, useRef, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const THEME_CHANGE_EVENT = 'theme-change';

export function getStoredThemeMode(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
}

export function getSystemTheme(): EffectiveTheme {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getEffectiveThemeFromMode(mode: ThemeMode, systemDark?: boolean): EffectiveTheme {
    if (mode === 'light' || mode === 'dark') return mode;
    const isDark = typeof systemDark === 'boolean' ? systemDark : getSystemTheme() === 'dark';
    return isDark ? 'dark' : 'light';
}

export function getEffectiveTheme(): EffectiveTheme {
    if (typeof document === 'undefined') return 'light';
    const root = document.documentElement;
    if (root.classList.contains('dark')) return 'dark';
    if (root.classList.contains('light')) return 'light';
    return getSystemTheme();
}

export function applyThemeMode(mode: ThemeMode, options?: { emit?: boolean }): EffectiveTheme {
    if (typeof document === 'undefined') return 'light';
    const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = getEffectiveThemeFromMode(mode, systemDark);
    const root = document.documentElement;
    root.classList.toggle('dark', effective === 'dark');
    root.classList.toggle('light', effective === 'light');
    root.dataset.themeMode = mode;
    root.style.colorScheme = effective;

    if (options?.emit !== false && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { mode, effective } }));
    }

    return effective;
}

export function useThemeMode() {
    const [mounted, setMounted] = useState(false);
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [effective, setEffective] = useState<EffectiveTheme>('light');
    const modeRef = useRef<ThemeMode>('system');

    useEffect(() => {
        const initialMode = getStoredThemeMode();
        const initialEffective = applyThemeMode(initialMode, { emit: false });
        modeRef.current = initialMode;
        setModeState(initialMode);
        setEffective(initialEffective);
        setMounted(true);

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMedia = () => {
            if (modeRef.current === 'system') {
                const nextEffective = applyThemeMode('system');
                setEffective(nextEffective);
            }
        };
        media.addEventListener('change', handleMedia);

        const handleThemeEvent = (event: Event) => {
            const detail = (event as CustomEvent).detail as { mode?: ThemeMode; effective?: EffectiveTheme } | undefined;
            if (!detail?.mode) return;
            modeRef.current = detail.mode;
            setModeState(detail.mode);
            setEffective(detail.effective ?? getEffectiveTheme());
        };
        window.addEventListener(THEME_CHANGE_EVENT, handleThemeEvent as EventListener);

        return () => {
            media.removeEventListener('change', handleMedia);
            window.removeEventListener(THEME_CHANGE_EVENT, handleThemeEvent as EventListener);
        };
    }, []);

    const setMode = (nextMode: ThemeMode) => {
        modeRef.current = nextMode;
        localStorage.setItem(THEME_STORAGE_KEY, nextMode);
        const nextEffective = applyThemeMode(nextMode);
        setModeState(nextMode);
        setEffective(nextEffective);
    };

    return {
        mounted,
        mode,
        effective,
        setMode,
    };
}
