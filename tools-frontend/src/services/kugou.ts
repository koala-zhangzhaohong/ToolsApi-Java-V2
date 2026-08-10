import type { JsonRecord } from '../types'
import { getJson } from './http'

export type KugouSearchType = 'song' | 'mv'

export interface KugouSearchPayload extends JsonRecord {
  data?: JsonRecord
}

export interface KugouMusicPayload extends JsonRecord {
  mock_preview_path?: Record<string, string>
  mock_download_path?: Record<string, string>
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

export async function searchKugou(keyword: string, type: KugouSearchType, page = 1, limit = 20) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (type === 'mv') {
    query.set('text', keyword)
    const response = await getJson<ApiResponse<KugouSearchPayload>>(`/tools/Kugou/api/search/mv?${query.toString()}`)
    return assertSuccess(response, '酷狗 MV 搜索失败')
  }
  query.set('key', keyword)
  const response = await getJson<ApiResponse<KugouSearchPayload>>(`/tools/Kugou/api/search?${query.toString()}`)
  return assertSuccess(response, '酷狗音乐搜索失败')
}

export async function resolveKugouMusic(hash: string, albumId: string) {
  const query = new URLSearchParams({
    hash,
    albumId,
    type: 'info',
  })
  const response = await getJson<ApiResponse<KugouMusicPayload>>(`/tools/Kugou/api?${query.toString()}`)
  return assertSuccess(response, '酷狗歌曲解析失败')
}
