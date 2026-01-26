/**
 * Wrap categories constants
 */
export const WRAP_CATEGORY = {
    OFFICIAL: 'official',
    AI_GENERATED: 'ai_generated',
    DIY: 'diy',
} as const;

export type WrapCategory = typeof WRAP_CATEGORY[keyof typeof WRAP_CATEGORY];
