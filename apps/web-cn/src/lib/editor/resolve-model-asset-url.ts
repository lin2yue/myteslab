/**
 * Resolve GLB / wheel URLs the same way as AI 设计页 (AIGeneratorMain),
 * so model-viewer loads identically (CDN rewrite + cross-origin proxy).
 */
export function resolveModelAssetUrl(url: string): string {
  if (!url) return ''

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

  let effective = url
  if (url.includes('aliyuncs.com')) {
    try {
      const urlObj = new URL(url)
      effective = `${cdnUrl}${urlObj.pathname}${urlObj.search}`
    } catch {
      effective = url
    }
  }

  if (effective.includes('cdn.tewan.club')) {
    return effective
  }

  if (typeof window !== 'undefined' && effective.startsWith('http') && !effective.includes(window.location.origin)) {
    return `/api/proxy?url=${encodeURIComponent(effective)}`
  }

  return effective
}
