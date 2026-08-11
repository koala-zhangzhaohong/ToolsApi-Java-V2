import { LinkOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Image, Input, Radio, Space, Typography } from 'antd'
import Hls from 'hls.js'
import flvjs from 'flv.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getJson } from '../services/http'
import type { PlayerPageData } from '../types'
import { attachManagedFlv } from '../utils/flvPlayback'
import { decodeUrlSafeBase64, firstNonEmpty } from '../utils/query'

type MediaType = 'video' | 'audio' | 'live' | 'image'

function inferType(pathname: string, src: string, requested: string | null): MediaType {
  if (requested === 'audio' || requested === 'live' || requested === 'image' || requested === 'video') return requested
  if (/music/i.test(pathname) || /\.(mp3|aac|flac|wav)(\?|$)/i.test(src)) return 'audio'
  if (/picture/i.test(pathname) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(src)) return 'image'
  if (/live/i.test(pathname) || /\.m3u8(\?|$)/i.test(src)) return 'live'
  return 'video'
}

function VideoPlayer({ src, live }: { src: string; live: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || !src) return
    if (/\.m3u8(\?|$)/i.test(src) && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: live })
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => hls.destroy()
    }
    if (/\.flv(\?|$)/i.test(src) && flvjs.isSupported()) {
      let cleanup: () => void = () => undefined
      const recreate = () => {
        cleanup()
        cleanup = attachManagedFlv({ video, url: src, live, onReconnect: recreate })
      }
      recreate()
      return () => cleanup()
    }
    video.src = src
  }, [src, live])
  return <video ref={ref} className="media-element" controls playsInline autoPlay={live} />
}

function legacyRoute(pathname: string) {
  const platform = /\/DouYin\//i.test(pathname) ? 'douyin' : /\/Netease\//i.test(pathname) ? 'netease' : /\/Kugou\//i.test(pathname) ? 'kugou' : ''
  const media = /picture/i.test(pathname) ? 'picture' : /music/i.test(pathname) ? 'music' : /live/i.test(pathname) ? 'live' : 'video'
  return { platform, media }
}

function qualitySources(data: PlayerPageData, media: string, params: URLSearchParams): string[] {
  const proxy = params.get('proxy') === 'true'
  const extra = Math.max(0, Number(params.get('proxyExtra') || 1) - 1)
  if (media === 'picture') return data.data || []
  if (proxy && data.proxyMultiVideoQualityInfoList?.[extra]) return Object.values(data.proxyMultiVideoQualityInfoList[extra]).filter(Boolean)
  if (media === 'live') return Object.values(data.multiLiveQualityInfo?.[params.get('type') || 'flv'] || {}).filter(Boolean)
  if (data.multiVideoQualityInfo) return Object.values(data.multiVideoQualityInfo).filter(Boolean)
  if (data.multiMvQualityInfo) return Object.values(data.multiMvQualityInfo).filter(Boolean)
  const mvInfo = data.mvInfo || data.mv_info
  if (media === 'video' && Array.isArray(mvInfo)) return mvInfo.map((item) => item.path).filter((value): value is string => typeof value === 'string' && value.length > 0)
  if (media === 'music') {
    const webPlayer = data.web_player_info as Record<string, unknown> | undefined
    const playerUrls = webPlayer?.player_url_list as Record<string, string> | undefined
    if (playerUrls) return Object.values(playerUrls).filter(Boolean)
    const itemInfo = data.item_info as { data?: Array<{ cdn_url?: string; url?: string }> } | undefined
    if (itemInfo?.data) return itemInfo.data.map((item) => item.cdn_url || item.url || '').filter(Boolean)
  }
  if (proxy && data.proxyPath) return [data.proxyPath]
  return data.path ? [data.path] : []
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

async function resolveKugouMusic(data: PlayerPageData, quality: string): Promise<string[]> {
  const musicInfo = nestedRecord(data.musicInfo || data.music_info)
  const audioInfo = nestedRecord(musicInfo?.audio_info || musicInfo?.audioInfo)
  const playInfoList = nestedRecord(audioInfo?.play_info_list || audioInfo?.playInfoList)
  const qualityKey = quality === '128' ? '128' : quality === 'high' ? 'high' : quality === 'flac' ? 'flac' : '320'
  const playInfo = nestedRecord(playInfoList?.[qualityKey])
  const albumInfo = nestedRecord(musicInfo?.album_info || musicInfo?.albumInfo)
  const hash = playInfo?.hash
  const albumId = albumInfo?.album_id || albumInfo?.albumId
  if (typeof hash !== 'string' || !albumId) return []
  const response = await getJson<{ data?: { url?: string[] } }>(`/tools/Kugou/api/playInfo?hash=${encodeURIComponent(hash)}&albumId=${encodeURIComponent(String(albumId))}`)
  return response.data?.url?.filter(Boolean) || []
}

export default function MediaPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const initialSrc = firstNonEmpty(params.get('src'), params.get('url'), decodeUrlSafeBase64(params.get('path')))
  const [source, setSource] = useState(initialSrc)
  const [title, setTitle] = useState(firstNonEmpty(decodeUrlSafeBase64(params.get('title')), params.get('title'), '媒体播放器'))
  const [type, setType] = useState<MediaType>(() => inferType(location.pathname, initialSrc, params.get('type')))
  const [activeSource, setActiveSource] = useState(initialSrc)
  const [legacyLoading, setLegacyLoading] = useState(false)
  const [legacyError, setLegacyError] = useState('')
  const [sources, setSources] = useState<string[]>(initialSrc ? [initialSrc] : [])
  const imageSources = useMemo(() => activeSource.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), [activeSource])
  const isLegacyShortRoute = location.pathname.includes('/short') && !initialSrc

  useEffect(() => {
    const key = params.get('key')
    if (!key || !location.pathname.includes('/short')) return
    const route = legacyRoute(location.pathname)
    setLegacyLoading(true)
    setLegacyError('')
    getJson<PlayerPageData>(`/api/frontend/pages/player?platform=${route.platform}&media=${route.media}&version=${params.get('version') || '2'}&key=${encodeURIComponent(key)}`)
      .then(async (data) => {
        let urls = qualitySources(data, route.media, params)
        if (!urls.length && route.platform === 'kugou' && route.media === 'music') {
          urls = await resolveKugouMusic(data, params.get('quality') || 'default')
        }
        const joined = route.media === 'picture' ? urls.join('\n') : (urls[0] || '')
        setSources(urls)
        setSource(joined)
        setActiveSource(joined)
        setTitle(data.title || '媒体播放器')
        setType(route.media === 'music' ? 'audio' : route.media === 'picture' ? 'image' : route.media === 'live' ? 'live' : 'video')
      })
      .catch((reason) => setLegacyError(reason instanceof Error ? reason.message : '媒体数据加载失败'))
      .finally(() => setLegacyLoading(false))
  }, [location.pathname, params])

  const play = () => {
    setActiveSource(source.trim())
    setParams({ src: source.trim(), type, title })
    document.title = title || 'Tools Console'
  }

  return (
    <div className="page-container media-page">
      <PageHeader eyebrow="UNIFIED PLAYER" title={title || '媒体播放器'} description="统一播放视频、音频、HLS 直播和图片集合。" />
      {legacyLoading && <Alert className="legacy-alert" type="info" showIcon message="正在读取旧页面媒体数据…" />}
      {legacyError && <Alert className="legacy-alert" type="error" showIcon message="媒体数据读取失败" description={legacyError} />}
      {isLegacyShortRoute && !legacyLoading && !legacyError && !activeSource && <Alert className="legacy-alert" type="warning" showIcon message="短链接数据不存在" description="对应 Redis 数据可能已过期，可以在下方直接粘贴媒体 URL。" />}
      <Card className="player-config" title="播放配置">
        <Form layout="vertical">
          <Form.Item label="媒体类型"><Radio.Group value={type} onChange={(event) => setType(event.target.value as MediaType)} optionType="button" buttonStyle="solid"><Radio.Button value="video">视频</Radio.Button><Radio.Button value="audio">音频</Radio.Button><Radio.Button value="live">HLS 直播</Radio.Button><Radio.Button value="image">图片</Radio.Button></Radio.Group></Form.Item>
          <Form.Item label={type === 'image' ? '图片地址（多个地址可换行或逗号分隔）' : '媒体地址'}>
            <Input.TextArea rows={type === 'image' ? 3 : 1} value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://example.com/media.mp4" />
          </Form.Item>
          <Form.Item label="标题"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Form.Item>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={play}>加载媒体</Button>
          {sources.length > 1 && <Space wrap className="quality-buttons">{sources.map((url, index) => <Button key={url} onClick={() => { setSource(url); setActiveSource(url) }}>清晰度 {index + 1}</Button>)}</Space>}
        </Form>
      </Card>
      <Card className="player-stage" styles={{ body: { padding: 0 } }}>
        {!activeSource ? <Empty image={<PlayCircleOutlined className="empty-player-icon" />} description="输入媒体地址后开始播放" /> : type === 'audio' ? (
          <div className="audio-stage"><div className="audio-art"><PlayCircleOutlined /></div><Typography.Title level={3}>{title}</Typography.Title><audio src={activeSource} controls autoPlay /></div>
        ) : type === 'image' ? (
          <Image.PreviewGroup><div className="image-grid">{imageSources.map((src) => <Image key={src} src={src} fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E" />)}</div></Image.PreviewGroup>
        ) : <VideoPlayer src={activeSource} live={type === 'live'} />}
      </Card>
      {activeSource && <Space className="source-link"><LinkOutlined /><Typography.Link href={activeSource.split(/[\n,]/)[0]} target="_blank">在新窗口打开源地址</Typography.Link></Space>}
    </div>
  )
}
