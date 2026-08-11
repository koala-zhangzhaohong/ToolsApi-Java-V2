import type { JsonRecord } from '../types'
import { getJson } from './http'

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

export async function searchNetease(keyword: string, type: NeteaseSearchType, page = 1, limit = 20) {
  const query = new URLSearchParams({
    text: keyword,
    type,
    page: String(page),
    limit: String(limit),
  })
  const response = await getJson<ApiResponse<NeteaseSearchPayload>>(`/tools/Netease/api/search?${query.toString()}`)
  return assertSuccess(response, '网易云搜索失败')
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
