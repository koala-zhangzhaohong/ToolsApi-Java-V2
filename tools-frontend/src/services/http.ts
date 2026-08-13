const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class HttpError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`请求失败（${status}）${body ? `：${body.slice(0, 160)}` : ''}`)
    this.name = 'HttpError'
  }
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return normalizeCdnProxyUrl(path)
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function normalizeCdnProxyUrl(value: string): string {
  return value.replace(/^(https?:\/\/[^/]+)\/doProxy(?=\?|$)/i, '$1/proxy/doProxy')
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    signal,
    headers: { Accept: 'application/json' },
  })
  const text = await response.text()
  if (!response.ok) throw new HttpError(response.status, text)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('服务端返回的不是有效 JSON')
  }
}
