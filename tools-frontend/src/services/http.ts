const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    signal,
    headers: { Accept: 'application/json' },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`请求失败（${response.status}）${text ? `：${text.slice(0, 160)}` : ''}`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('服务端返回的不是有效 JSON')
  }
}
