// Mask dimension configuration for each model
export const MASK_DIMENSIONS: Record<string, { width: number; height: number; aspectRatio: string }> = {
    'cybertruck': { width: 768, height: 1024, aspectRatio: '3:4' },
    'model-3': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-3-2024': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-3-2024-performance': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y-2025-standard': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y-2025-performance': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y-2025-premium': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'modely-l': { width: 1024, height: 1024, aspectRatio: '1:1' },
};

/**
 * Get mask dimensions for a specific model
 */
export function getMaskDimensions(modelSlug: string) {
    return MASK_DIMENSIONS[modelSlug] || { width: 1024, height: 1024, aspectRatio: '1:1' };
}

/**
 * Get mask URL for a specific model
 * Points to the production CDN where corrected masks are stored
 */
export function getMaskUrl(modelSlug: string, origin: string = '') {
    const cdnUrl = 'https://cdn.tewan.club';
    return `${cdnUrl}/masks/${modelSlug}_mask.png`;
}
