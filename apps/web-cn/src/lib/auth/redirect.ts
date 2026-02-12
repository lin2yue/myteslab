const AUTH_REDIRECT_BLOCKLIST = [
    /^\/login(?:\/|$)/i,
    /^\/auth(?:\/|$)/i,
    /^\/api\/auth(?:\/|$)/i,
    /^\/zh\/login(?:\/|$)/i,
    /^\/zh\/auth(?:\/|$)/i,
];

function tryDecode(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizeInternal(rawNext: string | null | undefined, fallback: string, depth: number): string {
    if (!rawNext || depth > 2) return fallback;

    const candidate = tryDecode(rawNext.trim());
    if (!candidate) return fallback;
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
    if (candidate.includes('\n') || candidate.includes('\r')) return fallback;

    try {
        const parsed = new URL(candidate, 'http://localhost');
        const pathname = parsed.pathname.replace(/\/{2,}/g, '/');
        const isBlocked = AUTH_REDIRECT_BLOCKLIST.some((rule) => rule.test(pathname));

        if (isBlocked) {
            const nestedNext = parsed.searchParams.get('next');
            if (nestedNext && nestedNext !== rawNext) {
                return normalizeInternal(nestedNext, fallback, depth + 1);
            }
            return fallback;
        }

        return `${pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return fallback;
    }
}

export function normalizeNextPath(rawNext: string | null | undefined, fallback = '/'): string {
    return normalizeInternal(rawNext, fallback, 0);
}
