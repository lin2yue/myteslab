/**
 * Global fetch proxy configuration for Node.js
 * This module patches the global fetch to honor HTTP_PROXY/HTTPS_PROXY.
 */

import { ProxyAgent, setGlobalDispatcher } from 'undici';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

function maskProxyUrl(url: string) {
    return url.replace(/\/\/([^:@]+):([^@]+)@/g, '//$1:***@');
}

if (proxyUrl && typeof globalThis !== 'undefined') {
    try {
        const agent = new ProxyAgent(proxyUrl);
        setGlobalDispatcher(agent);
        console.log('[Proxy] Proxy configured:', maskProxyUrl(proxyUrl));
    } catch (error) {
        console.error('[Proxy] Failed to configure proxy:', error);
    }
} else {
    console.log('[Proxy] No proxy configured');
    console.log('[Proxy] If Gemini API calls fail in CN, set HTTPS_PROXY or GEMINI_API_BASE_URL to a reachable endpoint');
}

export { };
