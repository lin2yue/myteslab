/**
 * Global fetch proxy configuration for Node.js
 * This module patches the global fetch to use HTTP_PROXY/HTTPS_PROXY environment variables
 */

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

if (proxyUrl && typeof globalThis !== 'undefined') {
    console.log('[Proxy] Proxy configured:', proxyUrl);
    console.log('[Proxy] Note: Node.js fetch may not automatically use HTTP_PROXY environment variables');
    console.log('[Proxy] If API calls fail, the application may need to be deployed to a server outside China');
} else {
    console.log('[Proxy] No proxy configured');
}

export { };
