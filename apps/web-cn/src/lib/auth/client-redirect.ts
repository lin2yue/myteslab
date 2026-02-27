import { normalizeNextPath } from '@/lib/auth/redirect';

const AUTH_REDIRECT_NEXT_KEY = 'auth_redirect_next';

function safeLocalGet(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeLocalSet(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ignore storage write failures in restricted WebView/private mode.
    }
}

function safeLocalRemove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore storage remove failures in restricted WebView/private mode.
    }
}

export function getCurrentPathWithSearch(fallback = '/'): string {
    if (typeof window === 'undefined') return fallback;
    return normalizeNextPath(`${window.location.pathname}${window.location.search}`, fallback);
}

export function rememberAuthRedirectNext(rawNext: string | null | undefined, fallback = '/'): string {
    const normalized = normalizeNextPath(rawNext, fallback);
    safeLocalSet(AUTH_REDIRECT_NEXT_KEY, normalized);
    return normalized;
}

export function clearAuthRedirectNext(): void {
    safeLocalRemove(AUTH_REDIRECT_NEXT_KEY);
}

export function resolveAuthRedirectNext(rawNext: string | null | undefined, fallback = '/'): string {
    const fromQuery = normalizeNextPath(rawNext, '');
    if (fromQuery) return fromQuery;

    const fromStorage = normalizeNextPath(safeLocalGet(AUTH_REDIRECT_NEXT_KEY), '');
    if (fromStorage) return fromStorage;

    return fallback;
}

export function consumeAuthRedirectNext(rawNext: string | null | undefined, fallback = '/'): string {
    const next = resolveAuthRedirectNext(rawNext, fallback);
    clearAuthRedirectNext();
    return next;
}
