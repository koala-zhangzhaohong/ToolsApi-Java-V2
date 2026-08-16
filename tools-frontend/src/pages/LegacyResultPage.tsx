import { ArrowLeftOutlined, CloudDownloadOutlined, LinkOutlined, PlayCircleOutlined, RadarChartOutlined, ReloadOutlined, StopOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Image, Input, Modal, Row, Skeleton, Space, Spin, Table, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import JsonTree from '../components/JsonTree'
import { useParseHistory } from '../hooks/useParseHistory'
import { getJson, postJson } from '../services/http'
import type { DouyinResult, PlayerPageData } from '../types'
import { downloadRoutes, isLocalDownloadProxy, localDownloadUrl } from '../utils/downloadRoute'
import { imagePreviewToolbar } from '../utils/imagePreview'
import { mediaRouteLabel } from '../utils/mediaRoute'
import { specialRankRouteLabel } from '../utils/rankRoute'
import LegacyErrorPage from './LegacyErrorPage'

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getUrls(value: unknown): string[] {
  if (nonEmpty(value)) return [value]
  if (Array.isArray(value)) return value.flatMap(getUrls)
  if (value && typeof value === 'object') return Object.values(value).flatMap(getUrls)
  return []
}

function unique(values: string[]) {
  return [...new Set(values.filter(nonEmpty))]
}

function rankRowsFromPayload(payload: DouyinResult | null | undefined): Array<Record<string, unknown>> {
  if (!payload) return []
  const wrapped = payload.data as Record<string, unknown> | undefined
  const list = (wrapped?.userList || wrapped?.user_list || payload.userList || payload.user_list) as Array<Record<string, unknown>> | undefined
  return Array.isArray(list) ? list : []
}

const rankRetryDelays = [0, 800, 1600, 2400]
const rankBatchSize = 20

function rankRowKey(row: Record<string, unknown>, index = 0) {
  return String(row.sec_uid || row.secUid || row.id || row.display_id || row.displayId || row.nickname || `rank-${index}`)
}

function isSpecialRankNickname(value: unknown) {
  if (!nonEmpty(value)) return false
  const nickname = value.trim()
  return nickname.startsWith('神秘人') || nickname.startsWith('dou') || nickname.startsWith('神秘嘉宾')
}

function isMaskedRankUser(row: Record<string, unknown>) {
  return String(row.display_id || row.displayId || '').trim() === '111111'
}

type GiftRecord = { time: number; message: string }
type MaskedListenerStatus = { liveId: string; listening: boolean }

function giftRecords(value: unknown): GiftRecord[] {
  const values = Array.isArray(value) ? value : []
  return values.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const message = record.msg || record.content || record.message
    if (!nonEmpty(message)) return []
    const rawTime = Number(record.gift_time || record.giftTime || record.time || record.timestamp || 0)
    const time = rawTime > 0 && rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime
    return [{ time, message }]
  })
}

function showGiftRecords(value: unknown) {
  const records = giftRecords(value)
  Modal.info({
    title: '最近送礼记录',
    className: 'legacy-gift-record-modal',
    width: 620,
    okText: '知道了',
    content: records.length ? (
      <div className="legacy-gift-records">
        {records.map((record, index) => <div className="legacy-gift-record" key={`${record.time}-${index}`}>
          <Typography.Text type="secondary">{record.time ? new Date(record.time).toLocaleString('zh-CN', { hour12: false }) : '时间未知'}</Typography.Text>
          <Typography.Text>{record.message}</Typography.Text>
        </div>)}
      </div>
    ) : <div className="legacy-gift-record-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无送礼记录" /></div>,
  })
}

function parentResultKey(returnTo: string) {
  if (!returnTo) return ''
  try {
    return new URL(returnTo, window.location.origin).searchParams.get('key') || ''
  } catch {
    return ''
  }
}

function rankNeedsRealNickname(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), window.location.origin)
    // 首次请求始终使用 extra=0 获取完整榜单；无论入口原本是简略版还是 Pro，
    // 都需要再按当前可见批次请求 extra=1 补全“原始昵称”。
    return /\/tools\/DouYin\/api\/ranklist\/audience\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

function rankSnapshotPath(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), window.location.origin)
    url.searchParams.set('extra', '0')
    return url.toString()
  } catch {
    return value
  }
}

function rankNicknameBatchPath(value: string, offset: number, count: number) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), window.location.origin)
    url.searchParams.set('extra', '1')
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('count', String(count))
    return url.toString()
  } catch {
    return value
  }
}

function rankRoomId(value: string) {
  try {
    return new URL(value.replace(/&amp;/g, '&'), window.location.origin).searchParams.get('roomId') || ''
  } catch {
    return ''
  }
}

const rankColumns = [
  {
    title: '昵称',
    key: 'nickname',
    width: 220,
    render: (_: unknown, row: Record<string, unknown>) => <div className="legacy-rank-nickname-cell">
      <span className="legacy-rank-nickname-text">{String(row.nickname || '—')}</span>
      {Boolean(row.__specialNickname) && <Button type="text" size="small" className="legacy-gift-button" title="查看最近送礼记录" aria-label="查看最近送礼记录" loading={Boolean(row.__giftRecordsLoading)} onClick={() => (row.__showGiftRecords as (() => void) | undefined)?.()}><span className="legacy-gift-button-icon">🎁</span><span className="legacy-gift-button-label">送礼记录</span></Button>}
    </div>,
  },
  {
    title: '账号',
    key: 'displayId',
    width: 220,
    render: (_: unknown, row: Record<string, unknown>) => String(row.display_id || row.displayId || '—'),
  },
  {
    title: '原始昵称',
    key: 'realNickname',
    width: 220,
    render: (_: unknown, row: Record<string, unknown>) => {
      const resolvedNickname = row.__resolvedRealNickname
      // A response for this row wins over an older failure marker.  This can
      // happen when a delayed batch response arrives after a previous request
      // for the same visible range has failed.
      if (nonEmpty(resolvedNickname)) return String(resolvedNickname)
      if (row.__realNicknameLoading) return <Space size={6}><Spin size="small" /><span>加载中</span></Space>
      if (row.__realNicknameFailed) return <Button type="link" size="small" onClick={() => (row.__retryRealNickname as (() => void) | undefined)?.()}>重试</Button>
      // 原始昵称批次未能匹配时，普通用户直接回退为榜单昵称；页面不应展示空值。
      return String(row.user_real_nickname || row.userRealNickName || row.nickname || '—')
    },
  },
]

function waitForRetry(delay: number, signal: AbortSignal) {
  if (delay <= 0) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delay)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Request aborted', 'AbortError'))
    }, { once: true })
  })
}

function isAppleMobileBrowser() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isWeChatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent)
}

function objectUrls(value: unknown): string[] {
  if (nonEmpty(value)) return [value]
  if (Array.isArray(value)) return value.flatMap(objectUrls)
  if (value && typeof value === 'object') return Object.values(value).flatMap(objectUrls)
  return []
}

function frontendUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin)
    if (/^\/tools\/(DouYin|Netease|Kugou)\/pro\/player\//.test(url.pathname)) {
      return `${window.location.origin}${url.pathname}${url.search}`
    }
    return value
  } catch {
    return value
  }
}

function originPreviewUrl(value: string): string {
  try {
    const url = new URL(frontendUrl(value), window.location.origin)
    url.searchParams.set('origin', 'true')
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  } catch {
    return value
  }
}

function applePreviewUrl(value: string) {
  if (!isAppleMobileBrowser()) return frontendUrl(value)
  try {
    const url = new URL(frontendUrl(value), window.location.origin)
    if (/\/tools\/DouYin\/pro\/player\/live\//i.test(url.pathname)) {
      url.searchParams.set('version', '2')
      url.searchParams.set('type', 'hls')
      return `${url.pathname}${url.search}`
    }
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  } catch {
    return frontendUrl(value)
  }
}

function internalReturnPath(value: string): string {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/')) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

function stripNavigationParams(value: string): string {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    url.searchParams.delete('returnTo')
    url.searchParams.delete('returnedFromChild')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

function withReturnedFromChild(value: string): string {
  const cleanPath = stripNavigationParams(value)
  if (!cleanPath) return ''
  const url = new URL(cleanPath, window.location.origin)
  url.searchParams.set('returnedFromChild', '1')
  return `${url.pathname}${url.search}${url.hash}`
}

interface CachedResultState {
  data: DouyinResult
  parseInput?: string
}

function getCacheKey(pathname: string, search: string) {
  return `tools-frontend:legacy-result:${pathname}${search}`
}

function readCachedState(pathname: string, search: string): CachedResultState | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(pathname, search))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedResultState>
    if (!parsed.data || typeof parsed.data !== 'object') return null
    return { data: parsed.data as DouyinResult, parseInput: typeof parsed.parseInput === 'string' ? parsed.parseInput : undefined }
  } catch {
    return null
  }
}

function writeCachedState(pathname: string, search: string, state: CachedResultState) {
  try {
    sessionStorage.setItem(getCacheKey(pathname, search), JSON.stringify(state))
  } catch {
    // ignore storage errors in private mode or locked-down browsers
  }
}

function LegacyPlayer({ url }: { url: string }) {
  const playerUrl = new URL(applePreviewUrl(url), window.location.origin)
  playerUrl.searchParams.set('embed', '1')
  return (
    <div className="legacy-player-frame">
      <iframe src={playerUrl.toString()} title="媒体预览" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
    </div>
  )
}

function LegacyWechatPlayer({ url }: { url: string }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    const playerUrl = new URL(applePreviewUrl(url), window.location.origin)
    const platform = /\/DouYin\//i.test(playerUrl.pathname) ? 'douyin' : /\/Netease\//i.test(playerUrl.pathname) ? 'netease' : 'kugou'
    const media = /live/i.test(playerUrl.pathname) ? 'live' : /video/i.test(playerUrl.pathname) ? 'video' : ''
    const key = playerUrl.searchParams.get('key')
    if (!key || !media) {
      setSrc(applePreviewUrl(url))
      return
    }
    getJson<PlayerPageData>(`/api/frontend/pages/player?platform=${platform}&media=${media}&version=${playerUrl.searchParams.get('version') || '2'}&key=${encodeURIComponent(key)}`)
      .then((result) => {
        if (disposed) return
        const liveSources = objectUrls(result.multiLiveQualityInfo?.hls || result.multiLiveQualityInfo?.HLS || result.multiLiveQualityInfo?.m3u8)
        const videoSources = objectUrls(result.path || result.proxyPath || result.multiVideoQualityInfo || result.multiMvQualityInfo)
        const nextSrc = liveSources[0] || videoSources[0]
        if (nextSrc) setSrc(nextSrc)
        else setError('暂未获取到可播放线路')
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : '媒体线路加载失败')
      })
    return () => { disposed = true }
  }, [url])

  if (error) return <div className="legacy-wechat-player-state">{error}</div>
  if (!src) return <div className="legacy-wechat-player-state">正在准备播放线路</div>
  return <video className="legacy-wechat-video" src={src} controls playsInline webkit-playsinline="true" x5-playsinline="true" preload="metadata" />
}

export default function LegacyResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as { data?: DouyinResult; parseInput?: string; returnedFromChild?: boolean } | null
  const routeData = routeState?.data
  const businessPath = useMemo(() => stripNavigationParams(`${location.pathname}${location.search}`), [location.pathname, location.search])
  const cacheUrl = useMemo(() => new URL(businessPath || location.pathname, window.location.origin), [businessPath, location.pathname])
  const cachedState = useMemo(() => readCachedState(cacheUrl.pathname, cacheUrl.search), [cacheUrl.pathname, cacheUrl.search])
  const parseInput = routeState?.parseInput?.trim() || cachedState?.parseInput?.trim() || ''
  const { addHistory } = useParseHistory()
  const [params] = useSearchParams()
  const key = params.get('key') || ''
  const id = Number(params.get('id') || 5)
  const remotePath = params.get('path') || ''
  const returnTo = stripNavigationParams(internalReturnPath(params.get('returnTo') || ''))
  const returnedFromChild = params.get('returnedFromChild') === '1' || Boolean(routeState?.returnedFromChild)
  // 排行榜的原始列表和 extra=1 批次必须来自同一份服务端快照。不能在刷新后
  // 复用浏览器缓存的旧列表，否则特殊用户已不在当前快照时会被误标为“重试”。
  const initialPayload = id === 7 ? null : (routeData || cachedState?.data || null)
  const initialData = initialPayload
  const [data, setData] = useState<DouyinResult | null>(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState('')
  const [picturePreview, setPicturePreview] = useState<{ sources: string[]; index: number } | null>(null)
  const [visibleRankCount, setVisibleRankCount] = useState(rankBatchSize)
  const [rankNicknames, setRankNicknames] = useState<Record<string, string>>({})
  const [rankGiftRecords, setRankGiftRecords] = useState<Record<string, unknown>>({})
  const [giftRecordLoadingKeys, setGiftRecordLoadingKeys] = useState<Set<string>>(() => new Set())
  const [cdnResolvedNicknameKeys, setCdnResolvedNicknameKeys] = useState<Set<string>>(() => new Set())
  const [rankNicknameLoading, setRankNicknameLoading] = useState(false)
  const [resolvingNicknameKeys, setResolvingNicknameKeys] = useState<Set<string>>(() => new Set())
  const [failedNicknameKeys, setFailedNicknameKeys] = useState<Set<string>>(() => new Set())
  const [maskedListenerStatus, setMaskedListenerStatus] = useState<MaskedListenerStatus | null>(null)
  const [maskedListenerLoading, setMaskedListenerLoading] = useState(false)
  const [maskedListenerStatusError, setMaskedListenerStatusError] = useState(false)
  const [stopListenerPasswordOpen, setStopListenerPasswordOpen] = useState(false)
  const [stopListenerPassword, setStopListenerPassword] = useState('')
  const [stopListenerPasswordError, setStopListenerPasswordError] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const nicknameRequestRef = useRef<AbortController | null>(null)
  const requestedNicknameKeys = useRef(new Set<string>())
  const promptedMaskedListenerKeys = useRef(new Set<string>())
  const rankLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const goBack = () => {
    if (parseInput) addHistory(parseInput)
    if (returnedFromChild) {
      navigate('/douyin', { replace: true })
      return
    }
    if (returnTo) {
      navigate(withReturnedFromChild(returnTo), { replace: true, state: { returnedFromChild: true } })
      return
    }
    if (location.key === 'default') {
      navigate('/douyin', { replace: true })
      return
    }
    navigate(-1)
  }

  const header = (showReload = true) => (
    <div className="legacy-result-header">
      <div className="legacy-result-heading">
        <Button type="text" className="legacy-back-button" icon={<ArrowLeftOutlined />} onClick={goBack}>返回</Button>
        <Typography.Text className="eyebrow">解析结果</Typography.Text>
        <Typography.Title level={2}>智能解析详情</Typography.Title>
      </div>
      {showReload && <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新数据</Button>}
    </div>
  )

  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    if (id === 7) {
      nicknameRequestRef.current?.abort()
      requestedNicknameKeys.current.clear()
      setRankNicknames({})
      setRankGiftRecords({})
      setGiftRecordLoadingKeys(new Set())
      setCdnResolvedNicknameKeys(new Set())
      setResolvingNicknameKeys(new Set())
      setFailedNicknameKeys(new Set())
      setVisibleRankCount(rankBatchSize)
      setRankNicknameLoading(false)
    }
    try {
      const delays = id === 7 ? rankRetryDelays : [0]
      let result: DouyinResult | null = null
      for (const [attempt, delay] of delays.entries()) {
        await waitForRetry(delay, controller.signal)
        try {
          const requestPath = id === 7 ? rankSnapshotPath(remotePath) : remotePath
          result = requestPath
            ? await getJson<DouyinResult>(`/api/frontend/pages/json?path=${encodeURIComponent(requestPath)}`, controller.signal)
            : await getJson<DouyinResult>(`/api/frontend/pages/json?key=${encodeURIComponent(key)}`, controller.signal)
          if (typeof result.code === 'number' && result.code !== 200 && result.message) throw new Error(result.message)
          // A successful empty rank response is a valid final state. Retry only
          // transient request/business errors, never an empty userList.
          break
        } catch (reason) {
          if (controller.signal.aborted || attempt === delays.length - 1) throw reason
        }
      }
      if (!controller.signal.aborted) setData(result)
    } catch (reason) {
      if (controller.signal.aborted) return
      setData(null)
      setError(reason instanceof Error ? reason.message : '页面数据加载失败')
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }, [id, key, remotePath])

  useEffect(() => {
    if (!data) return
    if (id === 7 && rankRowsFromPayload(data).length === 0) return
    writeCachedState(cacheUrl.pathname, cacheUrl.search, {
      data,
      parseInput: parseInput || routeState?.parseInput?.trim() || undefined,
    })
  }, [cacheUrl.pathname, cacheUrl.search, data, id, parseInput, routeState?.parseInput])

  useEffect(() => {
    if (id !== 7 && !routeData && cachedState?.data) {
      setData(cachedState.data)
      setLoading(false)
    }
  }, [cachedState?.data, id, routeData])

  useEffect(() => {
    if (id === 7) {
      void load()
    } else {
      const routeDataReady = Boolean(routeData)
      const cachedDataReady = Boolean(cachedState?.data)
      if (!routeDataReady && !cachedDataReady && (id < 1 || id > 3)) void load()
    }
    return () => requestRef.current?.abort()
  }, [cachedState?.data, id, load, routeData])
  useEffect(() => { if (parseInput) addHistory(parseInput) }, [addHistory, parseInput])

  const shouldResolveRankNicknames = useMemo(() => id === 7 && rankNeedsRealNickname(remotePath), [id, remotePath])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const iframe = document.querySelector<HTMLIFrameElement>('.legacy-player-frame iframe')
      if (!iframe || event.source !== iframe.contentWindow) return
      const message = event.data as { type?: unknown; sources?: unknown; index?: unknown }
      if (message?.type !== 'tools-api:picture-preview' || !Array.isArray(message.sources)) return
      const sources = unique(message.sources.filter(nonEmpty))
      if (!sources.length) return
      const requestedIndex = typeof message.index === 'number' ? message.index : 0
      setPicturePreview({ sources, index: Math.min(Math.max(0, requestedIndex), sources.length - 1) })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const media = useMemo(() => data?.media_data || {}, [data])
  const rank = useMemo(() => data?.rank_data || {}, [data])
  const previews = useMemo(() => unique([
    ...getUrls(media.proxy_preview_path),
    ...getUrls(media.preview_path).map(originPreviewUrl),
    ...getUrls(media.preview_path_hls),
    ...getUrls(media.preview_path_flv),
  ]).sort((first, second) => {
    if (!isAppleMobileBrowser()) return 0
    const firstIsHls = /m3u8|hls|type=hls/i.test(first)
    const secondIsHls = /m3u8|hls|type=hls/i.test(second)
    return Number(secondIsHls) - Number(firstIsHls)
  }), [media])
  const downloads = useMemo(() => downloadRoutes(media), [media])
  const ranks = useMemo(() => {
    const routes = [
      ...getUrls(rank.rank_list_url).map((url) => ({ url, label: '用户查询[简略]' })),
      ...getUrls(rank.rank_list_url_backup).map((url) => ({ url, label: '用户反查[Pro]' })),
      ...getUrls(rank.rank_list_special).map((url, index) => ({ url, label: specialRankRouteLabel(url, index) })),
    ]
    const seen = new Set<string>()
    return routes.filter(({ url }) => !seen.has(url) && Boolean(seen.add(url)))
  }, [rank])
  const rankRows = useMemo(() => rankRowsFromPayload(data), [data])

  const refreshMaskedListenerStatus = useCallback(async (signal?: AbortSignal) => {
    if (!key) return
    setMaskedListenerStatus(null)
    setMaskedListenerStatusError(false)
    setMaskedListenerLoading(true)
    try {
      const query = new URLSearchParams({ key })
      const liveId = data?.short_id || data?.unique_id
      if (nonEmpty(liveId)) query.set('liveId', liveId)
      const payload = await getJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/listener/status?${query}`, signal)
      if (typeof payload.code === 'number' && payload.code !== 200) throw new Error(payload.message || '监听状态查询失败')
      const status = payload.data as Record<string, unknown> | undefined
      if (!nonEmpty(status?.liveId)) throw new Error('未获取到直播间账号')
      setMaskedListenerStatus({ liveId: status.liveId, listening: status.listening === true })
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setMaskedListenerStatusError(true)
        console.warn('[masked-listener] listener status check failed', reason)
      }
    } finally {
      if (!signal?.aborted) setMaskedListenerLoading(false)
    }
  }, [data?.short_id, data?.unique_id, key])

  useEffect(() => {
    if (id === 7 || !data || ranks.length === 0 || !key) return
    const controller = new AbortController()
    void refreshMaskedListenerStatus(controller.signal)
    return () => controller.abort()
  }, [data, id, key, ranks.length, refreshMaskedListenerStatus])

  const toggleMaskedListener = useCallback(async () => {
    if (maskedListenerLoading) return
    if (!maskedListenerStatus?.liveId) {
      await refreshMaskedListenerStatus()
      return
    }
    const { liveId, listening } = maskedListenerStatus
    if (listening) {
      setStopListenerPassword('')
      setStopListenerPasswordError('')
      setStopListenerPasswordOpen(true)
      return
    }
    const run = async () => {
      setMaskedListenerLoading(true)
      try {
        const payload = await postJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/listener/start?liveId=${encodeURIComponent(liveId)}`)
        if (typeof payload.code === 'number' && payload.code !== 200) throw new Error(payload.message || '开启监听失败')
        setMaskedListenerStatus({ liveId, listening: true })
        Modal.success({
          title: '已开启脱敏榜单反查监听',
          content: '如监听到用户送礼操作，可刷新页面查询脱敏账号用户信息。',
        })
      } catch (reason) {
        Modal.error({ title: '开启监听失败', content: reason instanceof Error ? reason.message : '直播监听服务暂时不可用，请稍后重试。' })
      } finally {
        setMaskedListenerLoading(false)
      }
    }
    await run()
  }, [maskedListenerLoading, maskedListenerStatus, refreshMaskedListenerStatus])

  const stopMaskedListenerWithPassword = useCallback(async () => {
    const liveId = maskedListenerStatus?.liveId
    if (!liveId || !stopListenerPassword.trim()) {
      setStopListenerPasswordError('请输入管理密码')
      return
    }
    setMaskedListenerLoading(true)
    setStopListenerPasswordError('')
    try {
      const payload = await postJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/listener/stop?liveId=${encodeURIComponent(liveId)}`, { password: stopListenerPassword })
      if (typeof payload.code === 'number' && payload.code !== 200) {
        setStopListenerPasswordError(payload.message || '密码错误')
        return
      }
      setMaskedListenerStatus({ liveId, listening: false })
      setStopListenerPasswordOpen(false)
      setStopListenerPassword('')
      Modal.success({ title: '已关闭脱敏榜单反查监听', content: '该直播间已停止监听。' })
    } catch (reason) {
      setStopListenerPasswordError(reason instanceof Error ? reason.message : '直播监听服务暂时不可用，请稍后重试。')
    } finally {
      setMaskedListenerLoading(false)
    }
  }, [maskedListenerStatus?.liveId, stopListenerPassword])

  useEffect(() => {
    if (id !== 7 || !rankRows.some(isMaskedRankUser)) return
    const parentKey = parentResultKey(returnTo)
    if (!parentKey || promptedMaskedListenerKeys.current.has(parentKey)) return
    const controller = new AbortController()
    void getJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/listener/status?key=${encodeURIComponent(parentKey)}`, controller.signal)
      .then((statusPayload) => {
        if (!statusPayload || controller.signal.aborted) return
        if (typeof statusPayload.code === 'number' && statusPayload.code !== 200) return
        const status = statusPayload.data as Record<string, unknown> | undefined
        if (status?.listening === true || !nonEmpty(status?.liveId)) return
        const liveId = status.liveId
        promptedMaskedListenerKeys.current.add(parentKey)
        Modal.confirm({
          title: '检测到当前存在脱敏账号',
          content: '是否开始监听直播间？监听后，如若该用户出现送礼操作，可刷新页面查询脱敏账号用户信息。',
          okText: '开始监听',
          cancelText: '暂不',
          onOk: async () => {
            const started = await postJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/listener/start?liveId=${encodeURIComponent(liveId)}`)
            if (typeof started.code === 'number' && started.code !== 200) {
              Modal.error({ title: '启动监听失败', content: started.message || '直播监听服务暂时不可用，请稍后重试。' })
              throw new Error(started.message || '启动监听失败')
            }
            Modal.success({ title: '已开始监听', content: '如监听到用户送礼操作，可刷新页面查询脱敏账号用户信息。' })
          },
        })
      })
      .catch((reason) => {
        if (!controller.signal.aborted) console.warn('[masked-listener] listener status check failed', reason)
      })
    return () => controller.abort()
  }, [id, rankRows, returnTo])
  const retryRankNickname = useCallback(async (row: Record<string, unknown>, index: number) => {
    const key = rankRowKey(row, index)
    const nickname = String(row.nickname || '').trim()
    if (!nickname) return
    setFailedNicknameKeys((current) => {
      const next = new Set(current)
      next.delete(key)
      return next
    })
    setResolvingNicknameKeys((current) => new Set([...current, key]))
    try {
      const payload = await getJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/nickname/retry?nickname=${encodeURIComponent(nickname)}`)
      if (typeof payload.code === 'number' && payload.code !== 200) throw new Error(payload.message || '重试失败')
      const result = payload.data as Record<string, unknown> | undefined
      const resolvedNickname = result?.nickname || result?.user_real_nickname || result?.userRealNickName
      if (!nonEmpty(resolvedNickname)) throw new Error('未获取到真实昵称')
      setRankNicknames((current) => ({ ...current, [key]: resolvedNickname }))
      setRankGiftRecords((current) => ({ ...current, [key]: result?.extra || [] }))
      setCdnResolvedNicknameKeys((current) => new Set([...current, key]))
    } catch {
      setFailedNicknameKeys((current) => new Set([...current, key]))
    } finally {
      setResolvingNicknameKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }, [])
  const openRankGiftRecords = useCallback(async (row: Record<string, unknown>, index: number) => {
    const rowKey = rankRowKey(row, index)
    const currentRecords = rankGiftRecords[rowKey] ?? row.extra
    if (giftRecords(currentRecords).length > 0) {
      showGiftRecords(currentRecords)
      return
    }
    const roomId = rankRoomId(remotePath)
    const nickname = String(row.nickname || '').trim()
    if (!roomId || !nickname) {
      showGiftRecords([])
      return
    }
    setGiftRecordLoadingKeys((current) => new Set([...current, rowKey]))
    try {
      const query = new URLSearchParams({ roomId, nickname })
      const account = row.display_id || row.displayId
      const secUserId = row.sec_uid || row.secUid
      if (nonEmpty(account)) query.set('account', account)
      if (nonEmpty(secUserId)) query.set('secUserId', secUserId)
      const payload = await getJson<DouyinResult>(`/tools/DouYin/api/ranklist/audience/gift-records?${query}`)
      if (typeof payload.code === 'number' && payload.code !== 200) throw new Error(payload.message || '送礼记录查询失败')
      const result = payload.data as Record<string, unknown> | undefined
      const records = result?.extra || []
      setRankGiftRecords((current) => ({ ...current, [rowKey]: records }))
      showGiftRecords(records)
    } catch (reason) {
      Modal.error({ title: '送礼记录查询失败', content: reason instanceof Error ? reason.message : 'Live CDN 暂时不可用，请稍后重试。' })
    } finally {
      setGiftRecordLoadingKeys((current) => {
        const next = new Set(current)
        next.delete(rowKey)
        return next
      })
    }
  }, [rankGiftRecords, remotePath])
  const rankTableRows = useMemo(() => rankRows.slice(0, visibleRankCount).map((row, index) => ({
    ...row,
    __resolvedRealNickname: rankNicknames[rankRowKey(row, index)] || row.user_real_nickname || row.userRealNickName,
    __cdnResolved: cdnResolvedNicknameKeys.has(rankRowKey(row, index)),
    __specialNickname: isSpecialRankNickname(row.nickname),
    __giftRecordsLoading: giftRecordLoadingKeys.has(rankRowKey(row, index)),
    __showGiftRecords: () => { void openRankGiftRecords(row, index) },
    // 后端批次会为普通用户直接回填 nickname；此处保留同样的最终兜底，避免
    // 上游实时榜单变化或批次合并键异常时把已经可展示的昵称渲染成空值。
    user_real_nickname: rankNicknames[rankRowKey(row, index)] || row.user_real_nickname || row.userRealNickName || row.nickname,
    __realNicknameLoading: isSpecialRankNickname(row.nickname) && resolvingNicknameKeys.has(rankRowKey(row, index)),
    __realNicknameFailed: isSpecialRankNickname(row.nickname) && failedNicknameKeys.has(rankRowKey(row, index)),
    __retryRealNickname: () => { void retryRankNickname(row, index) },
    __rowKey: `${rankRowKey(row, index)}-${index}`,
  })), [cdnResolvedNicknameKeys, failedNicknameKeys, giftRecordLoadingKeys, openRankGiftRecords, rankNicknames, rankRows, resolvingNicknameKeys, retryRankNickname, visibleRankCount])

  useEffect(() => {
    if (!shouldResolveRankNicknames || !rankRows.length) return
    const batchStart = Math.max(0, visibleRankCount - rankBatchSize)
    const batchRows = rankRows.slice(batchStart, visibleRankCount)
    const pendingKeys = batchRows.map((row, offset) => rankRowKey(row, batchStart + offset))
      .filter((key, index) => !batchRows[index].user_real_nickname && !batchRows[index].userRealNickName && !requestedNicknameKeys.current.has(key))
    if (!pendingKeys.length) return

    nicknameRequestRef.current?.abort()
    const controller = new AbortController()
    nicknameRequestRef.current = controller
    pendingKeys.forEach((key) => requestedNicknameKeys.current.add(key))
    const specialPendingKeys = batchRows
      .map((row, index) => ({ row, key: rankRowKey(row, batchStart + index) }))
      .filter(({ row }) => isSpecialRankNickname(row.nickname))
      .map(({ key }) => key)
    if (specialPendingKeys.length) setResolvingNicknameKeys((current) => new Set([...current, ...specialPendingKeys]))
    setRankNicknameLoading(true)
    const batchPath = rankNicknameBatchPath(remotePath, batchStart, batchRows.length)
    void getJson<DouyinResult>(`/api/frontend/pages/json?path=${encodeURIComponent(batchPath)}`, controller.signal).then((payload) => {
      if (controller.signal.aborted) return
      const resolved: Record<string, string> = {}
      const resolvedExtras: Record<string, unknown> = {}
      const cdnResolvedKeys: string[] = []
      const batchEntries = batchRows.map((row, index) => ({
        row,
        key: rankRowKey(row, batchStart + index),
      }))
      rankRowsFromPayload(payload).forEach((row) => {
        const nickname = row.user_real_nickname || row.userRealNickName
        if (!nonEmpty(nickname)) return
        const responseKey = rankRowKey(row)
        const matched = batchEntries.find(({ row: source }) =>
          rankRowKey(source) === responseKey
          || (nonEmpty(source.nickname) && source.nickname === row.nickname)
          || (nonEmpty(source.display_id || source.displayId) && (source.display_id || source.displayId) === (row.display_id || row.displayId)),
        )
        if (matched) {
          resolved[matched.key] = nickname
          if (row.cdn_resolved === true || row.cdnResolved === true) {
            resolvedExtras[matched.key] = row.extra || []
            cdnResolvedKeys.push(matched.key)
          }
        }
      })
      if (Object.keys(resolved).length) setRankNicknames((current) => ({ ...current, ...resolved }))
      if (Object.keys(resolvedExtras).length) setRankGiftRecords((current) => ({ ...current, ...resolvedExtras }))
      if (cdnResolvedKeys.length) setCdnResolvedNicknameKeys((current) => new Set([...current, ...cdnResolvedKeys]))
      const resolvedKeys = new Set(Object.keys(resolved))
      if (resolvedKeys.size) setFailedNicknameKeys((current) => {
        const next = new Set(current)
        resolvedKeys.forEach((key) => next.delete(key))
        return next
      })
      const failed = specialPendingKeys.filter((key) => !resolvedKeys.has(key))
      if (failed.length) setFailedNicknameKeys((current) => new Set([...current, ...failed]))
    }).catch(() => {
      // A failed nickname batch must not hide the already rendered rank rows,
      // but special users still need an explicit retry entry instead of silently
      // falling back to the displayed nickname.
      if (!controller.signal.aborted && specialPendingKeys.length) {
        setFailedNicknameKeys((current) => new Set([...current, ...specialPendingKeys]))
      }
    }).finally(() => {
      if (nicknameRequestRef.current === controller) {
        nicknameRequestRef.current = null
        setRankNicknameLoading(false)
        if (specialPendingKeys.length) setResolvingNicknameKeys((current) => {
          const next = new Set(current)
          specialPendingKeys.forEach((key) => next.delete(key))
          return next
        })
      }
    })
    return () => controller.abort()
  }, [rankRows, remotePath, shouldResolveRankNicknames, visibleRankCount])

  useEffect(() => {
    const target = rankLoadMoreRef.current
    if (!target || visibleRankCount >= rankRows.length || rankNicknameLoading) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleRankCount((current) => Math.min(current + rankBatchSize, rankRows.length))
    }, { rootMargin: '160px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [rankNicknameLoading, rankRows.length, visibleRankCount])

  const downloadButton = ({ url, label, origin }: (typeof downloads)[number]) => {
    const href = localDownloadUrl(url, origin)
    return (
      <Button
        key={url}
        href={href}
        {...(isLocalDownloadProxy(href)
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : { download: true })}
        icon={<CloudDownloadOutlined />}
      >
        {label}
      </Button>
    )
  }

  const rankReturnTo = stripNavigationParams(`${location.pathname}${location.search}`)

  if (id >= 1 && id <= 3) return <LegacyErrorPage status={id === 1 ? 403 : id === 2 ? 404 : 500} />

  if (loading) return <div className="legacy-result-page">{header(false)}<Skeleton active paragraph={{ rows: 12 }} /></div>

  return (
    <div className="legacy-result-page">
      {header()}
      {error && <Alert type="error" showIcon message="数据加载失败" description={error} />}
      {!data && !error && <Empty description="暂无数据" />}
      {data && id !== 5 && previews[0] && <Card className="legacy-preview-card" styles={{ body: { padding: 0 } }}>{isAppleMobileBrowser() && isWeChatBrowser() ? <LegacyWechatPlayer url={previews[0]} /> : <LegacyPlayer url={previews[0]} />}</Card>}
      {picturePreview && <Image.PreviewGroup preview={{ visible: true, current: picturePreview.index, toolbarRender: imagePreviewToolbar, onChange: (index) => setPicturePreview((current) => current ? { ...current, index } : current), onVisibleChange: (visible) => { if (!visible) setPicturePreview(null) } }}>{picturePreview.sources.map((src) => <Image key={src} src={src} style={{ display: 'none' }} />)}</Image.PreviewGroup>}
      <Modal title="验证管理密码" open={stopListenerPasswordOpen} okText="验证并关闭" cancelText="取消" confirmLoading={maskedListenerLoading} okButtonProps={{ danger: true }} onOk={() => void stopMaskedListenerWithPassword()} onCancel={() => { setStopListenerPasswordOpen(false); setStopListenerPassword(''); setStopListenerPasswordError('') }} destroyOnHidden>
        <div className="legacy-listener-password-field">
          <Typography.Text>管理密码</Typography.Text>
          <Input.Password autoFocus autoComplete="current-password" placeholder="请输入管理密码" value={stopListenerPassword} status={stopListenerPasswordError ? 'error' : undefined} onChange={(event) => { setStopListenerPassword(event.target.value); setStopListenerPasswordError('') }} onPressEnter={() => void stopMaskedListenerWithPassword()} />
          {stopListenerPasswordError && <Typography.Text type="danger">{stopListenerPasswordError}</Typography.Text>}
        </div>
      </Modal>
      {data && id === 7 && <Card title="查询结果" className="legacy-section-card legacy-rank-card">
        <Table
          className="legacy-rank-table"
          columns={rankColumns}
          dataSource={rankTableRows}
          rowKey="__rowKey"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
          pagination={false}
          scroll={{ x: 660 }}
          size="middle"
        />
        {rankRows.length > 0 && <div className="legacy-rank-load-more" ref={rankLoadMoreRef}>
          {rankNicknameLoading ? <><Spin size="small" /><span>正在加载更多</span></> : visibleRankCount < rankRows.length ? <span>继续向下滑动加载更多</span> : <span>已加载全部 {rankRows.length} 条</span>}
        </div>}
      </Card>}
      {data && id !== 7 && (
        <Space direction="vertical" size={20} className="full-width">
          <Card title="数据详情" className="legacy-section-card">
            <Row gutter={[16, 16]} align="middle">
              <Col flex="auto"><Typography.Title level={4}>{data.desc || data.title || '未命名内容'}</Typography.Title><Typography.Text type="secondary"><UserOutlined /> {data.nickname || '未知作者'}</Typography.Text></Col>
              <Col className="legacy-ids"><Typography.Text type="secondary">{data.unique_id || data.room_id || data.song_id || '—'}</Typography.Text><Typography.Text type="secondary">{data.user_id || data.sec_uid || '—'}</Typography.Text></Col>
            </Row>
          </Card>
          {ranks.length > 0 && <Card title="用户榜单查询" className="legacy-section-card"><div className="legacy-action-grid">{ranks.map(({ url, label }) => <Button key={url} href={`/tools/json/printer/pro?path=${encodeURIComponent(url)}&id=7&returnTo=${encodeURIComponent(rankReturnTo)}`} icon={<UserOutlined />}>{label}</Button>)}<Button className={maskedListenerStatus?.listening ? 'legacy-listener-button legacy-listener-button-stop' : maskedListenerStatus ? 'legacy-listener-button legacy-listener-button-start' : 'legacy-listener-button legacy-listener-button-status'} loading={maskedListenerLoading} icon={maskedListenerStatus?.listening ? <StopOutlined /> : maskedListenerStatus ? <RadarChartOutlined /> : <ReloadOutlined />} onClick={() => void toggleMaskedListener()}>{maskedListenerLoading ? '正在获取监听状态' : maskedListenerStatusError ? '重新获取监听状态' : maskedListenerStatus?.listening ? '关闭脱敏榜单反查监听' : '开启脱敏榜单反查监听'}</Button></div></Card>}
          {previews.length > 0 && <Card title="预览" className="legacy-section-card"><div className="legacy-action-grid">{previews.map((url, index) => <Button key={url} href={frontendUrl(url)} target="_blank" icon={<PlayCircleOutlined />}>{mediaRouteLabel(url, index)}</Button>)}</div></Card>}
          {downloads.length > 0 && <Card title="下载" className="legacy-section-card"><div className="legacy-action-grid">{downloads.map(downloadButton)}</div></Card>}
          {id === 4 && <Card title={<Space><LinkOutlined />JSON 数据</Space>}><pre className="legacy-json-plain">{JSON.stringify(data, null, 2)}</pre></Card>}
          {id === 5 && <Card title={<Space><LinkOutlined />完整数据</Space>}><JsonTree data={data} /></Card>}
          <Typography.Text type="secondary" className="legacy-disclaimer">* 仅供学习使用，禁止用于商业用途</Typography.Text>
        </Space>
      )}
    </div>
  )
}
