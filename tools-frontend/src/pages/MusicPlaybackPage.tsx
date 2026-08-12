import { ArrowLeftOutlined, CustomerServiceOutlined } from '@ant-design/icons'
import { Button, Result, Space } from 'antd'
import { Spin } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collectNeteasePlaybackSources, neteasePlaybackInfo, readMusicPlayback } from '../services/musicPlayback'
import { resolveNeteaseMusic, type NeteaseQuality } from '../services/netease'
import { getJson } from '../services/http'
import MusicPlayerPage from './MusicPlayerPage'
import { musicMeta } from './musicMeta'

function waitForBrowserIdle() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 750 })
    } else {
      setTimeout(resolve, 120)
    }
  })
}

export default function MusicPlaybackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const key = params.get('key') || ''
  const payload = useMemo(() => key ? readMusicPlayback(key) : null, [key])
  const meta = useMemo(() => payload ? musicMeta(payload.data) : null, [payload])
  const [proxySources, setProxySources] = useState<string[]>([])
  const [proxyLoading, setProxyLoading] = useState(true)
  const [proxyError, setProxyError] = useState('')
  const [availableQualityOptions, setAvailableQualityOptions] = useState<Array<{ value: string; label: string }>>([])
  const qualityCache = useRef(new Map<NeteaseQuality, string>())
  const qualityAddressCache = useRef(new Map<NeteaseQuality, string>())
  const neteaseInfo = useMemo(() => payload?.platform === 'netease' ? neteasePlaybackInfo(payload.data) : null, [payload])

  const registerSource = useCallback(async (source: string) => {
    const absoluteSource = new URL(source, window.location.origin).toString()
    const query = new URLSearchParams({ url: absoluteSource })
    if (payload?.platform) query.set('platform', payload.platform)
    return getJson<{ url?: string; downloadUrl?: string }>(`/api/frontend/pages/media-url?${query.toString()}`)
  }, [payload?.platform])

  const proxySource = useCallback(async (source: string) => {
    const response = await registerSource(source)
    return response.url || ''
  }, [registerSource])

  const prepareDownload = useCallback(async (source: string) => {
    const response = await registerSource(source)
    if (!response.downloadUrl) throw new Error('下载线路准备失败，请重新解析后再试')
    return response.downloadUrl
  }, [registerSource])

  useEffect(() => {
    let active = true
    setProxySources([])
    setProxyError('')
    setAvailableQualityOptions(neteaseInfo
      ? neteaseInfo.qualities.filter((option) => option.value === neteaseInfo.currentQuality)
      : [])
    qualityCache.current.clear()
    qualityAddressCache.current.clear()
    if (neteaseInfo?.source) qualityAddressCache.current.set(neteaseInfo.currentQuality, neteaseInfo.source)
    if (!payload?.sources.length) {
      setProxyLoading(false)
      return () => { active = false }
    }
    setProxyLoading(true)
    const sources = Promise.all(payload.sources.map(async (source) => {
      try {
        return await proxySource(source)
      } catch {
        return ''
      }
    }))
    void sources.then((validSources) => {
      if (!active) return
      setProxySources(validSources.filter(Boolean))
      if (neteaseInfo && validSources[0]) qualityCache.current.set(neteaseInfo.currentQuality, validSources[0])
      if (!validSources.some(Boolean)) setProxyError('播放线路代理准备失败，请返回搜索结果重新解析。')
      setProxyLoading(false)
    }).catch(() => {
      if (!active) return
      setProxyError('播放线路代理准备失败，请返回搜索结果重新解析。')
      setProxyLoading(false)
    })
    return () => { active = false }
  }, [neteaseInfo, payload, proxySource])

  const resolveQualityAddress = useCallback(async (quality: NeteaseQuality) => {
    if (!neteaseInfo?.songId) throw new Error('缺少歌曲 ID，无法切换音质')
    const cached = qualityAddressCache.current.get(quality)
    if (cached) return cached
    const qualityData = await resolveNeteaseMusic(neteaseInfo.songId, quality)
    const source = collectNeteasePlaybackSources(qualityData)[0]
    if (!source) throw new Error('该音质没有可播放地址')
    qualityAddressCache.current.set(quality, source)
    return source
  }, [neteaseInfo])

  const resolveQualitySource = useCallback(async (quality: string) => {
    const value = quality as NeteaseQuality
    const cached = qualityCache.current.get(value)
    if (cached) return cached
    const source = await resolveQualityAddress(value)
    const proxied = await proxySource(source)
    if (!proxied) throw new Error('该音质代理准备失败')
    qualityCache.current.set(value, proxied)
    return proxied
  }, [proxySource, resolveQualityAddress])

  useEffect(() => {
    if (!neteaseInfo?.songId) {
      setAvailableQualityOptions([])
      return
    }
    let active = true
    const current = neteaseInfo.qualities.filter((option) => option.value === neteaseInfo.currentQuality)
    setAvailableQualityOptions(current)
    const candidates = neteaseInfo.qualities.filter((option) => option.value !== neteaseInfo.currentQuality)
    void (async () => {
      for (const option of candidates) {
        await waitForBrowserIdle()
        if (!active) return
        try {
          await resolveQualityAddress(option.value)
          if (!active) return
          setAvailableQualityOptions((previous) => {
            const valid = new Set([...previous.map((item) => item.value), option.value])
            return neteaseInfo.qualities.filter((item) => valid.has(item.value))
          })
        } catch {
          // Unavailable qualities stay out of the selector.
        }
      }
    })()
    return () => { active = false }
  }, [neteaseInfo, resolveQualityAddress])

  if (!payload) {
    return (
      <Result
        status="warning"
        title="播放数据已失效"
        subTitle="请回到搜索结果重新解析歌曲。"
        extra={<Button type="text" className="legacy-back-button legacy-back-button-result" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
      />
    )
  }

  if (!payload.sources.length) {
    return (
      <Result
        icon={<CustomerServiceOutlined />}
        title="歌曲已解析，但没有可播放音频地址"
        subTitle={meta ? `${meta.title} - ${meta.artist}` : '可以稍后重试，或查看接口数据确认歌曲是否受版权限制。'}
        extra={<Button type="text" className="legacy-back-button legacy-back-button-result" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回搜索结果</Button>}
      />
    )
  }

  if (proxyLoading) {
    return (
      <div className="page-container music-playback-page">
        <Space direction="vertical" size={16} className="full-width">
          <Button type="text" className="legacy-back-button" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <div className="music-playback-loading"><Spin size="large" tip="正在准备播放线路" /></div>
        </Space>
      </div>
    )
  }

  if (!proxySources.length) {
    return (
      <Result
        status="error"
        title="播放线路不可用"
        subTitle={proxyError || (meta ? `${meta.title} - ${meta.artist}` : '请返回搜索结果重新解析歌曲。')}
        extra={<Button type="text" className="legacy-back-button legacy-back-button-result" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回搜索结果</Button>}
      />
    )
  }

  return (
    <div className="page-container music-playback-page">
      <Space direction="vertical" size={16} className="full-width">
        <Button type="text" className="legacy-back-button" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        <MusicPlayerPage
          data={payload.data}
          sources={proxySources}
          sourceLabels={payload.sourceLabels}
          qualityOptions={neteaseInfo ? availableQualityOptions : undefined}
          initialQuality={neteaseInfo?.currentQuality}
          onQualityChange={neteaseInfo ? resolveQualitySource : undefined}
          onDownload={prepareDownload}
        />
      </Space>
    </div>
  )
}
