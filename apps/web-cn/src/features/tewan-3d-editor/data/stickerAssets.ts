export type StickerAsset =
  | {
      id: string
      name: string
      category: 'numbers' | 'racing' | 'badges'
      kind: 'svg'
      colorable: true
      svg: string
    }
  | {
      id: string
      name: string
      category: 'png'
      kind: 'png'
      src: string
    }

export type StickerResourceLink = {
  label: string
  href: string
  note: string
}

export const RACING_STICKER_ASSETS: StickerAsset[] = [
  {
    id: 'number-roundel-07',
    name: '圆形号码 07',
    category: 'numbers',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><circle cx="160" cy="160" r="142" fill="currentColor"/><circle cx="160" cy="160" r="115" fill="#fff"/><text x="160" y="208" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="142" fill="currentColor">07</text></svg>`,
  },
  {
    id: 'number-plate-86',
    name: '方形号码 86',
    category: 'numbers',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260"><rect x="18" y="18" width="384" height="224" rx="18" fill="#fff" stroke="currentColor" stroke-width="28"/><text x="210" y="194" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="178" fill="currentColor">86</text></svg>`,
  },
  {
    id: 'door-number-21',
    name: '门板号码 21',
    category: 'numbers',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 240"><path d="M32 30h456l-34 180H66L32 30Z" fill="#fff" stroke="currentColor" stroke-width="24" stroke-linejoin="round"/><text x="260" y="178" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="154" fill="currentColor">21</text></svg>`,
  },
  {
    id: 'speed-stripes',
    name: '速度斜纹',
    category: 'racing',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 220"><path d="M31 186 146 34h83L113 186H31Zm152 0L298 34h83L265 186h-82Zm152 0L450 34h39l-8 152H335Z" fill="currentColor"/></svg>`,
  },
  {
    id: 'racing-chevron',
    name: '赛道箭头',
    category: 'racing',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 220"><path d="M29 36h142l89 74-89 74H29l90-74-90-74Zm230 0h105l89 74-89 74H259l90-74-90-74Z" fill="currentColor"/></svg>`,
  },
  {
    id: 'pit-crew-wordmark',
    name: 'PIT CREW 字标',
    category: 'badges',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 180"><path d="M22 24h576l-34 132H56L22 24Z" fill="currentColor"/><text x="310" y="119" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="82" letter-spacing="6" fill="#fff">PIT CREW</text></svg>`,
  },
  {
    id: 'apex-wordmark',
    name: 'APEX 字标',
    category: 'badges',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 190"><path d="M40 150 117 34h74l39 116h-60l-8-28h-67l-18 28H40Zm74-69h36l-9-33-27 33Zm130 69V34h129c38 0 60 20 60 50 0 33-25 55-66 55h-64v11h-59Zm59-61h52c13 0 21-5 21-15s-8-15-21-15h-52v30Zm148 61 47-58-44-58h66l15 24 18-24h68l-51 58 48 58h-68l-18-27-20 27h-61Z" fill="currentColor"/></svg>`,
  },
  {
    id: 'track-outline',
    name: '赛道线稿',
    category: 'racing',
    kind: 'svg',
    colorable: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 320"><path d="M87 235c-45-31-46-106 0-137 40-27 88 6 124-19 29-20 26-60 77-64 58-5 93 45 78 88-12 35-49 43-42 76 8 37 72 28 87 76 15 48-34 86-90 68-47-15-50-61-93-69-48-10-85 20-141-19Z" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'carbon-slash',
    name: '碳纤维斜切',
    category: 'png',
    kind: 'png',
    src: '/editor-stickers/carbon-slash.png',
  },
  {
    id: 'checker-badge',
    name: '黑白格徽章',
    category: 'png',
    kind: 'png',
    src: '/editor-stickers/checker-badge.png',
  },
]

export const STICKER_RESOURCE_LINKS: StickerResourceLink[] = [
  {
    label: 'Wikimedia 赛车团队 Logo',
    href: 'https://commons.wikimedia.org/wiki/Category:Automobile_racing_team_logos',
    note: '很多 SVG/PNG 附带授权和商标说明，适合做来源清单。',
  },
  {
    label: 'Wikimedia Motorsport Logos',
    href: 'https://commons.wikimedia.org/wiki/Category:Motorsports_logos',
    note: '可检索赛事、车队、厂商相关标识。',
  },
  {
    label: 'Michelin Design System',
    href: 'https://designsystem.michelin.com/components/logo',
    note: '官方品牌组件入口，使用前看 brand center 规则。',
  },
  {
    label: 'Gran Turismo Decal Uploader',
    href: 'https://www.gran-turismo.com/',
    note: '游戏涂装生态的参考入口，素材导出/复用需确认授权。',
  },
]
