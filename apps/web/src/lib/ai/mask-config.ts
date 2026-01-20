// Mask dimension configuration for each model
export const MASK_DIMENSIONS: Record<string, { width: number; height: number; aspectRatio: string }> = {
    'cybertruck': { width: 1024, height: 768, aspectRatio: '4:3' },
    'model-3': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-3-2024-plus': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y-pre-2025': { width: 1024, height: 1024, aspectRatio: '1:1' },
    'model-y-2025-plus': { width: 1024, height: 1024, aspectRatio: '1:1' },
};

/**
 * Get mask dimensions for a specific model
 */
export function getMaskDimensions(modelSlug: string) {
    return MASK_DIMENSIONS[modelSlug] || { width: 1024, height: 768, aspectRatio: '4:3' };
}
