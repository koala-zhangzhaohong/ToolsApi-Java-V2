import type { MediaData } from '../types'

export interface DownloadRoute {
  url: string
  label: string
}

function content(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function qualityLabel(value: string): string {
  const quality = value.trim().toLowerCase().replace(/[_-]/g, '')
  if (/^(origin|original|source|raw)$/.test(quality)) return '原画'
  if (/^(uhd|2160p?|4k)$/.test(quality)) return '超高清 4K'
  if (/^(2k|1440p?)$/.test(quality)) return '超高清 2K'
  if (/^(fhd|1080p?)$/.test(quality)) return '全高清 1080P'
  if (/^(hd|720p?)$/.test(quality)) return '高清 720P'
  if (/^(sd|540p?|480p?)$/.test(quality)) return '标清'
  if (/^(ld|360p?)$/.test(quality)) return '流畅'
  return value.toUpperCase()
}

function proxyGroups(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  if (value && typeof value === 'object') return [value as Record<string, unknown>]
  return []
}

export function downloadRoutes(media: MediaData): DownloadRoute[] {
  const routes: DownloadRoute[] = []
  proxyGroups(media.proxy_download_path).forEach((group, groupIndex) => {
    Object.entries(group).forEach(([quality, url]) => {
      if (content(url)) routes.push({ url, label: `CDN 线路 ${groupIndex + 1} · ${qualityLabel(quality)}` })
    })
  })
  if (content(media.download_path)) {
    routes.push({ url: media.download_path, label: '回源线路 · 原画' })
  }

  const seen = new Set<string>()
  return routes.filter(({ url }) => !seen.has(url) && Boolean(seen.add(url)))
}

export function localDownloadUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin)
    if (url.pathname === '/short') {
      const key = url.searchParams.get('key')
      if (key) return `/api/frontend/pages/download?key=${encodeURIComponent(key)}`
    }
  } catch {
    // Preserve the source value so callers retain their existing error behavior.
  }
  return value
}

export function isLocalDownloadProxy(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && url.pathname === '/api/frontend/pages/download'
  } catch {
    return false
  }
}
