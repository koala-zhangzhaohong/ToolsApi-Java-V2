import type { JsonRecord } from '../types'
import { getJson } from './http'

export interface LanzouFileInfo extends JsonRecord {
  file_name?: string
  fileName?: string
  file_size?: string
  fileSize?: string
  update_time?: string
  updateTime?: string
  author?: string
  download_host?: string
  downloadHost?: string
  download_path?: string
  downloadPath?: string
  download_url?: string
  downloadUrl?: string
  redirect_url?: string
  redirectUrl?: string
}

export interface LanzouResponse extends JsonRecord {
  code?: number
  message?: string
  data?: LanzouFileInfo | LanzouFileInfo[] | null
}

interface LanzouDownloadResponse extends JsonRecord {
  code?: number
  message?: string
  data?: { downloadUrl?: string } | null
}

export function lanzouApiPath(url: string, password: string, type: 'info' | 'download' = 'info') {
  const params = new URLSearchParams({ url, type })
  if (password) params.set('password', password)
  return `/tools/LanZou/api?${params.toString()}`
}

export async function parseLanzouShare(url: string, password: string) {
  const response = await getJson<LanzouResponse>(lanzouApiPath(url, password))
  if (response.code !== 200) {
    const messages: Record<number, string> = {
      101: '蓝奏云分享链接无效，请检查后重试。',
      102: '解析类型无效。',
      201: '文件不存在、已取消分享或链接已经失效。',
      202: '该分享需要提取密码，请输入密码后重试。',
      203: '提取密码错误，请检查后重试。',
      299: '蓝奏云页面数据读取失败，请稍后重试。',
    }
    throw new Error(messages[response.code ?? -1] || response.message || `解析失败（业务码 ${response.code ?? -1}）`)
  }
  return response
}

export async function prepareLanzouDownload(url: string, password: string, file?: LanzouFileInfo, fileName?: string, folder = false) {
  const params = new URLSearchParams({ url })
  if (password) params.set('password', password)
  if (fileName) params.set('fileName', fileName)
  if (folder) params.set('folder', 'true')
  const metadata: Array<[string, unknown]> = [
    ['downloadHost', file?.download_host ?? file?.downloadHost],
    ['downloadPath', file?.download_path ?? file?.downloadPath],
    ['downloadUrl', file?.download_url ?? file?.downloadUrl],
    ['redirectUrl', file?.redirect_url ?? file?.redirectUrl],
  ]
  metadata.forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) params.set(key, value.trim())
  })
  const response = await getJson<LanzouDownloadResponse>(`/tools/LanZou/download-url?${params.toString()}`)
  const downloadUrl = response.data?.downloadUrl
  if (response.code !== 200 || !downloadUrl) {
    throw new Error(response.message || '下载地址生成失败，请重新解析后重试。')
  }
  return downloadUrl
}
