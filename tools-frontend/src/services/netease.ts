import type { JsonRecord } from '../types'
import { apiUrl, getJson } from './http'

export type NeteaseSearchType = '1' | '10' | '100' | '1000' | '1002' | '1004' | '1006' | '1009'
export type NeteaseQuality = 'default' | 'standard' | 'exhigh' | 'lossless' | 'hires'

export interface NeteaseSearchPayload extends JsonRecord {
  page?: number
  limit?: number
  response?: JsonRecord
}

export interface NeteaseMusicPayload extends JsonRecord {
  item_info?: {
    data?: Array<{
      mock_preview_path?: string
      mock_download_path?: string
      url?: string
      cdn_url?: string
      type?: string
    }>
  }
  web_player_info?: JsonRecord
}

export interface NeteaseMvPayload extends JsonRecord {
  mock_preview_path?: string
  mock_multi_download_path?: Record<string, string>
}

interface ApiResponse<T> extends JsonRecord {
  code?: number
  message?: string
  data?: T
}

function assertSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(response.message || `${fallback}（业务码 ${response.code}）`)
  }
  if (response.data === undefined || response.data === null) throw new Error(fallback)
  return response.data
}

const chineseDigits: Record<string, number> = {
  '零': 0,
  '〇': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
}

function normalizeChineseNumbers(value: string) {
  return value.replace(/[零〇一二两三四五六七八九十]+/g, (token) => {
    if (!token.includes('十')) return [...token].map((item) => chineseDigits[item]).join('')
    const [tens, units = ''] = token.split('十')
    if (tens.length > 1 || units.length > 1) return token
    return String((tens ? chineseDigits[tens] : 1) * 10 + (units ? chineseDigits[units] : 0))
  })
}

async function requestNeteaseSearch(keyword: string, type: NeteaseSearchType, page: number, limit: number) {
  const query = new URLSearchParams({
    text: keyword,
    type,
    page: String(page),
    limit: String(limit),
  })
  const response = await getJson<ApiResponse<NeteaseSearchPayload>>(`/tools/Netease/api/search?${query.toString()}`)
  return assertSuccess(response, '网易云搜索失败')
}

export async function searchNetease(keyword: string, type: NeteaseSearchType, page = 1, limit = 20) {
  const data = await requestNeteaseSearch(keyword, type, page, limit)
  if (type !== '1004') return data

  const result = data.response?.result
  const mvRows = result && typeof result === 'object' ? (result as JsonRecord).mvs : undefined
  const hasMvResults = Array.isArray(mvRows) && mvRows.length > 0
  const normalizedKeyword = normalizeChineseNumbers(keyword)
  if (hasMvResults || normalizedKeyword === keyword) return data
  return requestNeteaseSearch(normalizedKeyword, type, page, limit)
}

export async function resolveNeteaseMusic(id: string, quality: NeteaseQuality = 'standard') {
  const query = new URLSearchParams({
    id,
    type: 'info',
    lyric: 'true',
    quality,
    toWebPlayer: 'true',
  })
  const response = await getJson<ApiResponse<NeteaseMusicPayload>>(`/tools/Netease/api?${query.toString()}`)
  return assertSuccess(response, '网易云歌曲解析失败')
}

export async function resolveNeteaseMv(id: string) {
  const query = new URLSearchParams({ mid: id, type: 'info' })
  const response = await getJson<ApiResponse<NeteaseMvPayload>>(`/tools/Netease/api/mv?${query.toString()}`)
  return assertSuccess(response, '网易云 MV 解析失败')
}

export async function resetNeteaseCookie(cookie: string) {
  const query = new URLSearchParams({ lock: 'false', cookie })
  const response = await fetch(apiUrl(`/tools/Netease/reset/cookie?${query.toString()}`), {
    headers: { Accept: 'text/plain' },
  })
  const output = await response.text()
  if (!response.ok) throw new Error(`刷新 Cookie 失败（${response.status}）${output ? `：${output.slice(0, 160)}` : ''}`)
  return output
}
