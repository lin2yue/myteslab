export type MaterialMapRule = {
  includeExact: string[]
  includeKeywords: string[]
  excludeKeywords: string[]
}

const DEFAULT_RULE: MaterialMapRule = {
  includeExact: ['ext_body', 'carpaint', 'body_paint'],
  includeKeywords: ['paint', 'body', 'exterior', 'stainless', 'wrap'],
  excludeKeywords: [
    'glass',
    'window',
    'windshield',
    'wheel',
    'rim',
    'tire',
    'tyre',
    'brake',
    'caliper',
    'interior',
    'seat',
    'dashboard',
    'light',
    'lamp',
    'headlight',
    'taillight',
    'logo',
    'emblem',
    'mirror'
  ]
}

export const MATERIAL_MAP_BY_MODEL: Record<string, MaterialMapRule> = {
  cybertruck: {
    ...DEFAULT_RULE,
    includeExact: ['ext_body', 'cyber_body', 'body_stainless']
  },
  'model-3': {
    ...DEFAULT_RULE,
    includeExact: ['ext_body', 'body_paint', 'carpaint']
  },
  'model-3-2024': {
    ...DEFAULT_RULE,
    includeExact: ['ext_body', 'body_paint', 'highland_body']
  },
  'model-y': {
    ...DEFAULT_RULE,
    includeExact: ['ext_body', 'body_paint', 'carpaint']
  },
  'model-y-2025-standard': {
    ...DEFAULT_RULE,
    includeExact: ['ext_body', 'body_paint', 'juniper_body']
  }
}

export function getMaterialRuleByModel(modelSlug: string): MaterialMapRule {
  return MATERIAL_MAP_BY_MODEL[modelSlug] ?? DEFAULT_RULE
}
