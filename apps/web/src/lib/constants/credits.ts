/**
 * 积分系统全局配置
 * Single Source of Truth for all credit-related constants
 * Migrated from feat-polar-integration branch
 */

/**
 * 服务类型枚举
 */
export enum ServiceType {
    AI_GENERATION = 'ai_generation',
    // 未来可扩展其他服务类型：
    // PREMIUM_GENERATION = 'premium_generation',
    // CUSTOM_SERVICE = 'custom_service',
}

/**
 * 服务积分消耗配置
 */
export const CREDITS_CONFIG = {
    [ServiceType.AI_GENERATION]: {
        baseAmount: 10,                    // 基础消耗积分 (10 credits per generation)
        displayName: 'AI生成',
        displayNameEn: 'AI Generation',
        description: 'AI车贴生成服务',
        descriptionEn: 'AI wrap generation service',
    },
} as const;

/**
 * 价格套餐基础配置（仅包含不变的数据）
 */
interface PricingTierBase {
    id: string;
    nameKey: string;      // i18n key
    price: string;        // USD
    credits: number;      // 赠送积分
    popular?: boolean;
    savings?: string;     // 节省百分比
    polarProductId: string; // [NEW] Polar.sh product ID
}

/**
 * 完整的价格套餐（包含计算属性）
 */
export interface PricingTier extends PricingTierBase {
    generations: number;  // 约等于生成次数（自动计算）
    costPerGen: string;   // 单次成本（自动计算）
}

/**
 * 价格套餐基础数据
 */
const PRICING_TIERS_BASE: PricingTierBase[] = [
    {
        id: 'starter',
        nameKey: 'starter',
        price: '4.99',
        credits: 100,
        polarProductId: '3f5b29c4-563f-4d37-91b0-584f58b9683a',
    },
    {
        id: 'explorer',
        nameKey: 'explorer',
        price: '9.99',
        credits: 250,
        popular: true,
        savings: '20',
        polarProductId: 'd70e4de3-c53c-41db-a86a-9f5c6e6af6d9',
    },
    {
        id: 'collector',
        nameKey: 'collector',
        price: '19.99',
        credits: 700,
        savings: '40',
        polarProductId: '05816746-1a3a-46d2-a40e-4c513d19fad7',
    }
];

/**
 * 计算套餐的衍生属性
 */
function calculateTierMetrics(tier: PricingTierBase): PricingTier {
    const baseAmount = CREDITS_CONFIG[ServiceType.AI_GENERATION].baseAmount;
    const generations = Math.floor(tier.credits / baseAmount);
    const costPerGen = (parseFloat(tier.price) / generations).toFixed(3);

    return {
        ...tier,
        generations,
        costPerGen,
    };
}

/**
 * 导出的价格套餐配置（带自动计算）
 * 显式指定类型以确保 IDE 提示友好
 */
export const PRICING_TIERS: PricingTier[] = PRICING_TIERS_BASE.map(calculateTierMetrics);

/**
 * 折扣配置（预留扩展）
 */
export const DISCOUNT_CONFIG = {
    // 未来可以添加：
    // seasonal: { 
    //   rate: 0.8, 
    //   validUntil: '2026-12-31',
    //   description: 'Holiday discount'
    // },
    // bulk: { 
    //   minCredits: 500, 
    //   rate: 0.9,
    //   description: 'Bulk purchase discount'
    // },
} as const;

/**
 * 辅助函数：获取服务消耗积分
 */
export function getServiceCost(serviceType: ServiceType): number {
    return CREDITS_CONFIG[serviceType].baseAmount;
}

/**
 * 辅助函数：计算折扣后价格（预留）
 */
export function calculateDiscountedCost(
    baseAmount: number,
    discountKey?: keyof typeof DISCOUNT_CONFIG
): number {
    if (!discountKey) return baseAmount;
    // 未来实现折扣逻辑
    return baseAmount;
}

/**
 * 辅助函数：重新计算所有套餐（用于动态调整）
 */
export function recalculatePricingTiers(): PricingTier[] {
    return PRICING_TIERS_BASE.map(calculateTierMetrics);
}
