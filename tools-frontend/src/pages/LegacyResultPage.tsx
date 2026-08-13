import { ArrowLeftOutlined, CloudDownloadOutlined, LinkOutlined, PlayCircleOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import JsonTree from '../components/JsonTree'
import { useParseHistory } from '../hooks/useParseHistory'
import { getJson } from '../services/http'
import type { DouyinResult, PlayerPageData } from '../types'
import { downloadRoutes, isLocalDownloadProxy, localDownloadUrl } from '../utils/downloadRoute'
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
  const [data, setData] = useState<DouyinResult | null>(routeData || cachedState?.data || null)
  const [loading, setLoading] = useState(!(routeData || cachedState?.data))
  const [error, setError] = useState('')

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
      {showReload && <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新数据</Button>}
    </div>
  )

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = remotePath
        ? await getJson<DouyinResult>(`/api/frontend/pages/json?path=${encodeURIComponent(remotePath)}`)
        : await getJson<DouyinResult>(`/api/frontend/pages/json?key=${encodeURIComponent(key)}`)
      if (typeof result.code === 'number' && result.code !== 200 && result.message) throw new Error(result.message)
      setData(result)
    } catch (reason) {
      setData(null)
      setError(reason instanceof Error ? reason.message : '页面数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!data) return
    writeCachedState(cacheUrl.pathname, cacheUrl.search, {
      data,
      parseInput: parseInput || routeState?.parseInput?.trim() || undefined,
    })
  }, [cacheUrl.pathname, cacheUrl.search, data, parseInput, routeState?.parseInput])

  useEffect(() => {
    if (!routeData && cachedState?.data) {
      setData(cachedState.data)
      setLoading(false)
    }
  }, [cachedState?.data, routeData])

  useEffect(() => { if (!routeData && !cachedState?.data && (id < 1 || id > 3)) void load() }, [key, remotePath, id, routeData, cachedState?.data]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (parseInput) addHistory(parseInput) }, [addHistory, parseInput])

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
  const rankRows = useMemo(() => {
    if (!data) return []
    const wrapped = data.data as Record<string, unknown> | undefined
    const list = (wrapped?.userList || wrapped?.user_list || data.userList || data.user_list) as Array<Record<string, unknown>> | undefined
    return Array.isArray(list) ? list : []
  }, [data])

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
      {data && id === 7 && <Card title="查询结果" className="legacy-section-card legacy-rank-card">
        {rankRows.length ? <div className="legacy-rank-table"><table><thead><tr><th>昵称</th><th>账号</th><th>原始昵称</th></tr></thead><tbody>{rankRows.map((row, index) => <tr key={index}><td>{String(row.nickname || '')}</td><td>{String(row.display_id || row.displayId || '')}</td><td>{String(row.user_real_nickname || row.userRealNickName || '')}</td></tr>)}</tbody></table></div> : <Empty description="暂无数据" />}
      </Card>}
      {data && id !== 7 && (
        <Space direction="vertical" size={20} className="full-width">
          <Card title="数据详情" className="legacy-section-card">
            <Row gutter={[16, 16]} align="middle">
              <Col flex="auto"><Typography.Title level={4}>{data.desc || data.title || '未命名内容'}</Typography.Title><Typography.Text type="secondary"><UserOutlined /> {data.nickname || '未知作者'}</Typography.Text></Col>
              <Col className="legacy-ids"><Typography.Text type="secondary">{data.unique_id || data.room_id || data.song_id || '—'}</Typography.Text><Typography.Text type="secondary">{data.user_id || data.sec_uid || '—'}</Typography.Text></Col>
            </Row>
          </Card>
          {ranks.length > 0 && <Card title="用户榜单查询" className="legacy-section-card"><div className="legacy-action-grid">{ranks.map(({ url, label }) => <Button key={url} href={`/tools/json/printer/pro?path=${encodeURIComponent(url)}&id=7&returnTo=${encodeURIComponent(rankReturnTo)}`} icon={<UserOutlined />}>{label}</Button>)}</div></Card>}
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
