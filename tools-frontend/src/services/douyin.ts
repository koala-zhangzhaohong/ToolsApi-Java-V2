import type { DouyinResult, JsonRecord } from '../types'
import { getJson } from './http'

interface DouyinApiResponse extends JsonRecord {
  code?: number
  message?: string
  data?: DouyinResult
}

function isRecord(value: unknown): value is DouyinResult {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function frontendProPath(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value, window.location.origin)
    if (url.pathname !== '/tools/json/printer/pro') return undefined
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}

export async function parseDouyinShare(link: string) {
  const response = await getJson<DouyinApiResponse>(`/tools/DouYin/api?version=4&type=simple&directJsonViewer=false&link=${encodeURIComponent(link)}`)
  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(response.message || `解析失败（业务码 ${response.code}）`)
  }
  const result = isRecord(response.data) ? response.data : response as DouyinResult
  return {
    result,
    proPath: frontendProPath(result.pro || response.pro),
  }
}
