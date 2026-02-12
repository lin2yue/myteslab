import { NextRequest } from 'next/server';
import crypto from 'crypto';

type InternalAuthOptions = {
    legacySecret?: string;
    hmacSecret?: string;
    allowLegacyToken?: boolean;
    maxSkewSeconds?: number;
};

function timingSafeEqualString(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function readLegacyToken(request: NextRequest): string {
    const headerToken = (request.headers.get('x-wrap-worker-secret') || '').trim();
    if (headerToken) return headerToken;

    const auth = (request.headers.get('authorization') || '').trim();
    if (auth.toLowerCase().startsWith('bearer ')) {
        return auth.slice('bearer '.length).trim();
    }
    return '';
}

function normalizeSignature(input: string): string {
    const value = input.trim().toLowerCase();
    if (value.startsWith('sha256=')) return value.slice('sha256='.length);
    return value;
}

export function verifyInternalRequest(
    request: NextRequest,
    rawBody: string,
    options: InternalAuthOptions
): boolean {
    const legacySecret = (options.legacySecret || '').trim();
    const hmacSecret = (options.hmacSecret || '').trim();
    const allowLegacyToken = options.allowLegacyToken ?? true;
    const maxSkewSeconds = Math.max(1, Number(options.maxSkewSeconds ?? 300));

    const ts = (request.headers.get('x-wrap-timestamp') || '').trim();
    const signature = normalizeSignature(request.headers.get('x-wrap-signature') || '');

    if (hmacSecret && ts && signature) {
        const tsNum = Number(ts);
        if (!Number.isFinite(tsNum)) return false;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - tsNum) > maxSkewSeconds) return false;

        const payload = `${ts}.${rawBody}`;
        const expected = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
        return timingSafeEqualString(expected, signature);
    }

    if (hmacSecret && !allowLegacyToken) {
        return false;
    }

    if (!legacySecret) {
        return false;
    }

    const legacyToken = readLegacyToken(request);
    if (!legacyToken) return false;
    return timingSafeEqualString(legacyToken, legacySecret);
}

