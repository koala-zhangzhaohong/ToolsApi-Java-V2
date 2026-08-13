import {
  ClearOutlined,
  CustomerServiceOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { Alert, App, Button, Card, Empty, Form, Input, List, Modal, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useProgressiveRows } from '../hooks/useProgressiveRows'
import { collectNeteasePlaybackSources, saveMusicPlayback } from '../services/musicPlayback'
import { resetNeteaseCookie, resolveNeteaseMusic, resolveNeteaseMv, searchNetease, type NeteaseSearchPayload, type NeteaseSearchType } from '../services/netease'
import type { JsonRecord } from '../types'
import { legacyPreviewRoute } from '../utils/legacyPreview'

const historyKey = 'tools-frontend:netease-search-history'
const historyChangedEvent = 'tools-frontend:netease-search-history-change'
const maxHistorySize = 8

const searchTypes: Array<{ label: string; value: NeteaseSearchType; listKey: string; countKey: string }> = [
  { label: '单曲', value: '1', listKey: 'songs', countKey: 'songCount' },
  { label: 'MV', value: '1004', listKey: 'mvs', countKey: 'mvCount' },
]

const examples = ['周杰伦', '晴天', '林俊杰', '起风了']
const pageSize = 20
const cookieSuffix = ' __remember_me=true; appver=8.9.75;'
const settingsPasswordSalt = 'toolsapi-netease-cookie-settings-v1'
const settingsPasswordIterations = 210_000
const settingsPasswordHash = '5a6815d135a467532d1b0095bd55720446450e1ceda6bd76a8a7273de0ff8f66'

function uniqueHistory(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, maxHistorySize)
}

function readHistory() {
  try {
    const raw = localStorage.getItem(historyKey)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? uniqueHistory(parsed.filter((item): item is string => typeof item === 'string')) : []
  } catch {
    return []
  }
}

function writeHistory(values: string[]) {
  const next = uniqueHistory(values)
  localStorage.setItem(historyKey, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(historyChangedEvent, { detail: next }))
  return next
}

function useNeteaseSearchHistory() {
  const [history, setHistory] = useState<string[]>(readHistory)

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = event && 'detail' in event ? (event as CustomEvent<unknown>).detail : undefined
      setHistory(Array.isArray(detail) ? uniqueHistory(detail.filter((item): item is string => typeof item === 'string')) : readHistory())
    }
    const syncStorage = (event: StorageEvent) => {
      if (event.key === historyKey || event.key === null) sync()
    }
    window.addEventListener(historyChangedEvent, sync)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(historyChangedEvent, sync)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  return {
    history,
    addHistory: (keyword: string) => setHistory(writeHistory([keyword, ...readHistory().filter((item) => item !== keyword.trim())])),
    clearHistory: () => setHistory(writeHistory([])),
  }
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function firstText(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

function idText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function recordList(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const row = record(item)
    return row ? [row] : []
  }) : []
}

function names(value: unknown) {
  return recordList(value).map((item) => text(item.name)).filter(Boolean).join(' / ')
}

function songArtists(item: JsonRecord) {
  return names(item.artists || item.ar) || '未知歌手'
}

function itemAlbum(item: JsonRecord) {
  const album = record(item.album || item.al)
  return text(album?.name, '未知专辑')
}

function formatDuration(value: unknown) {
  const duration = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(duration) || duration <= 0) return ''
  const seconds = Math.round(duration / 1000)
  const minute = Math.floor(seconds / 60)
  return `${minute}:${String(seconds % 60).padStart(2, '0')}`
}

function resultTitle(item: JsonRecord, type: NeteaseSearchType) {
  if (type === '1006') return text(item.name, '未命名歌曲')
  return text(item.name || item.title, type === '1000' ? '未命名歌单' : '未命名结果')
}

function resultDescription(item: JsonRecord, type: NeteaseSearchType) {
  if (type === '1' || type === '1006') return [songArtists(item), itemAlbum(item)].filter(Boolean).join(' · ')
  if (type === '1000') {
    const creator = record(item.creator)
    return [`创建者：${text(creator?.nickname, '未知')}`, `歌曲：${idText(item.trackCount) || 0}`].join(' · ')
  }
  if (type === '100') return [names(item.alias), text(item.accountId ? `账号：${item.accountId}` : '')].filter(Boolean).join(' · ') || '网易云歌手'
  if (type === '10') return [songArtists(item), text(item.publishTime ? `发布：${new Date(Number(item.publishTime)).getFullYear()}` : '')].filter(Boolean).join(' · ') || '网易云专辑'
  if (type === '1004') return [text(item.artistName) || names(item.artists), formatDuration(item.duration)].filter(Boolean).join(' · ') || '网易云 MV'
  return '网易云搜索结果'
}

function resultCover(item: JsonRecord, type: NeteaseSearchType) {
  const album = record(item.album || item.al)
  const albumInfo = record(item.album_info || item.albumInfo)
  const cover = type === '1' || type === '1006'
    ? firstText(album?.picUrl, item.cover, item.coverUrl, item.coverImgUrl, item.picUrl, album?.blurPicUrl, item.img1v1Url)
    : firstText(
      item.cover,
      item.coverUrl,
      item.coverImgUrl,
      item.picUrl,
      type === '10' ? album?.picUrl : undefined,
      type === '10' ? album?.blurPicUrl : undefined,
      type === '10' ? albumInfo?.sizable_cover : undefined,
      type === '10' ? albumInfo?.sizableCover : undefined,
      type === '10' ? albumInfo?.img : undefined,
      item.img1v1Url,
    )
  if (cover) return cover.includes('{size}') ? cover.replace('{size}', '1080') : cover
  const picId = idText(album?.picId || item.picId || item.coverId || albumInfo?.picId)
  return (type === '1' || type === '10' || type === '1006') && picId ? `https://music.163.com/api/img/blur/${encodeURIComponent(picId)}` : ''
}

function resultUrl(item: JsonRecord, type: NeteaseSearchType) {
  const id = idText(item.id)
  if (!id) return ''
  if (type === '1000') return `https://music.163.com/#/playlist?id=${id}`
  if (type === '100') return `https://music.163.com/#/artist?id=${id}`
  if (type === '10') return `https://music.163.com/#/album?id=${id}`
  if (type === '1004') return `https://music.163.com/#/mv?id=${id}`
  return `https://music.163.com/#/song?id=${id}`
}

interface SearchTemplateProps {
  type: NeteaseSearchType
  history: string[]
  rows: JsonRecord[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  resolvingId: string
  onLoadMore: () => void
  onPlay: (item: JsonRecord) => void
  onSelectHistoryItem: (value: string) => void
  onSearchHistoryItem: (value: string) => void
  onClearHistory: () => void
}

interface NeteaseHistoryCardProps {
  history: string[]
  className?: string
  onSelectHistoryItem: (value: string) => void
  onSearchHistoryItem: (value: string) => void
  onClearHistory: () => void
}

function NeteaseHistoryCard({
  history,
  className = 'legacy-section-card netease-template-card',
  onSelectHistoryItem,
  onSearchHistoryItem,
  onClearHistory,
}: NeteaseHistoryCardProps) {
  return (
    <Card
      title={<Space><HistoryOutlined /> 搜索历史</Space>}
      className={className}
      extra={history.length > 0 && <Button type="text" danger icon={<ClearOutlined />} onClick={onClearHistory}>清空</Button>}
    >
      {history.length ? (
        <List
          className="netease-history-list"
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              className="search-history-item"
              role="button"
              tabIndex={0}
              onClick={() => onSelectHistoryItem(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectHistoryItem(item)
                }
              }}
              actions={[<Button type="link" onClick={(event) => { event.stopPropagation(); onSearchHistoryItem(item) }}>再次搜索</Button>]}
            >
              <Typography.Text ellipsis>{item}</Typography.Text>
            </List.Item>
          )}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无搜索记录" />}
    </Card>
  )
}

function NeteaseSearchTemplate({
  type,
  history,
  rows,
  total,
  hasMore,
  loadingMore,
  resolvingId,
  onLoadMore,
  onPlay,
  onSelectHistoryItem,
  onSearchHistoryItem,
  onClearHistory,
}: SearchTemplateProps) {
  const { visibleRows, sentinelRef, hasHiddenRows } = useProgressiveRows(rows, hasMore, onLoadMore)
  const footerText = hasHiddenRows
    ? `已显示 ${visibleRows.length} / ${rows.length} 条，继续向下滚动显示更多`
    : hasMore ? '继续向下滚动以加载更多内容' : `已加载全部 ${rows.length} 条结果`

  return (
    <Space direction="vertical" size={20} className="full-width">
      <NeteaseHistoryCard
        history={history}
        onSelectHistoryItem={onSelectHistoryItem}
        onSearchHistoryItem={onSearchHistoryItem}
        onClearHistory={onClearHistory}
      />

      <Card
        title={<Space><CustomerServiceOutlined /> 搜索结果</Space>}
        className="legacy-section-card netease-template-card"
        extra={<Typography.Text type="secondary">共 {total} 条</Typography.Text>}
      >
        {rows.length ? (
          <>
            <List
              className="netease-result-list"
              dataSource={visibleRows}
              renderItem={(item) => {
                const id = idText(item.id)
                const cover = resultCover(item, type)
                const external = resultUrl(item, type)
                const duration = type === '1' || type === '1006'
                  ? formatDuration(item.duration || item.dt)
                  : ''
                return (
                  <List.Item
                    actions={[
                      (type === '1' || type === '1006' || type === '1004') && id ? <Button key="play" type="primary" icon={<PlayCircleOutlined />} loading={resolvingId === id} onClick={() => onPlay(item)}>解析播放</Button> : null,
                      external ? <Button key="external" icon={<LinkOutlined />} href={external} target="_blank">网易云</Button> : null,
                      id ? <Button key="api" href={`/json?url=${encodeURIComponent(type === '1004' ? `/tools/Netease/api/mv?mid=${encodeURIComponent(id)}&type=info` : `/tools/Netease/api?id=${encodeURIComponent(id)}&type=info&toWebPlayer=true`)}`}>接口数据</Button> : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={cover ? <img className="netease-cover" src={cover} alt="" loading="lazy" decoding="async" /> : <span className="netease-cover netease-cover-placeholder"><CustomerServiceOutlined /></span>}
                      title={<div className="netease-result-title"><Typography.Text strong ellipsis>{resultTitle(item, type)}</Typography.Text>{duration && <Tag className="netease-duration-tag">{duration}</Tag>}</div>}
                      description={<Space direction="vertical" size={3}><Typography.Text type="secondary">{resultDescription(item, type)}{duration && <span className="netease-duration-inline"> · {duration}</span>}</Typography.Text>{id && <Typography.Text type="secondary">ID：{id}</Typography.Text>}</Space>}
                    />
                  </List.Item>
                )
                }}
              />
            <div className="netease-infinite-footer">
              <div ref={sentinelRef} className="netease-load-sentinel" />
              <Spin spinning={loadingMore} tip={hasMore ? '正在加载下一页…' : '已加载全部结果'}>
                <Typography.Text type="secondary">{footerText}</Typography.Text>
              </Spin>
            </div>
          </>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无搜索结果" />}
      </Card>
    </Space>
  )
}

export default function NeteasePage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<NeteaseSearchType>('1')
  const [limit, setLimit] = useState(pageSize)
  const [searchedKeyword, setSearchedKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [resolvingId, setResolvingId] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<NeteaseSearchPayload | null>(null)
  const [rows, setRows] = useState<JsonRecord[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [settingsPassword, setSettingsPassword] = useState('')
  const [passwordChecking, setPasswordChecking] = useState(false)
  const [cookieKey, setCookieKey] = useState('')
  const [cookieSubmitting, setCookieSubmitting] = useState(false)
  const [cookieResult, setCookieResult] = useState<{ input: string; output: string } | null>(null)
  const { history, addHistory, clearHistory } = useNeteaseSearchHistory()
  const searchSessionRef = useRef(0)
  const selectedTypeRef = useRef<NeteaseSearchType>('1')
  const latestParamsRef = useRef({ keyword: '', type: '1' as NeteaseSearchType, page: 1, limit: pageSize })
  const loadingMoreRef = useRef(false)

  const search = useCallback(async (value = keyword, nextPage = 1, nextLimit = limit, nextType = selectedTypeRef.current, append = false) => {
    const input = value.trim()
    if (!input) { message.warning('请先输入网易云搜索关键词'); return }
    const typeMeta = searchTypes.find((item) => item.value === nextType) || searchTypes[0]
    const sessionId = append ? searchSessionRef.current : ++searchSessionRef.current
    if (append) {
      if (loading || loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      selectedTypeRef.current = nextType
      setType(nextType)
      setLoading(true)
      setLoadingMore(false)
      setError('')
      setRows([])
      setTotal(0)
      setHasMore(false)
      setResult(null)
      latestParamsRef.current = { keyword: input, type: nextType, page: nextPage, limit: nextLimit }
    }
    try {
      const data = await searchNetease(input, nextType, nextPage, nextLimit)
      if (sessionId !== searchSessionRef.current) return
      const currentResponse = record(data.response)
      const root = record(currentResponse?.result)
      const pageRows = recordList(root?.[typeMeta.listKey])
      const countKey = typeMeta.countKey
      const nextTotal = Number(root?.[countKey] || pageRows.length || 0)
      setResult(data)
      setTotal(nextTotal)
      setRows((prev) => append ? [...prev, ...pageRows] : pageRows)
      setLimit(nextLimit)
      setType(nextType)
      setSearchedKeyword(input)
      latestParamsRef.current = { keyword: input, type: nextType, page: nextPage, limit: nextLimit }
      setHasMore(nextPage * nextLimit < nextTotal && pageRows.length > 0)
      if (!append) addHistory(input)
    } catch (reason) {
      if (sessionId !== searchSessionRef.current) return
      const raw = reason instanceof Error ? reason.message : '网易云搜索失败'
      setError(/请求失败（5\d\d）/.test(raw) ? '网易云后端暂未启动或接口异常，请确认本地 8080 已运行后重试。' : raw)
    } finally {
      if (sessionId === searchSessionRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
      if (append && sessionId === searchSessionRef.current) loadingMoreRef.current = false
    }
  }, [addHistory, keyword, limit, loading, message])

  const loadMore = useCallback(() => {
    if (loading || loadingMoreRef.current || !hasMore) return
    const { keyword: currentKeyword, type: currentType, page: currentPage, limit: currentLimit } = latestParamsRef.current
    void search(currentKeyword, currentPage + 1, currentLimit, currentType, true)
  }, [hasMore, loading, search])

  const searchFromHistory = useCallback((value: string) => {
    setKeyword(value)
    void search(value, 1, limit)
  }, [limit, search])

  const selectHistoryItem = useCallback((value: string) => {
    setKeyword(value)
  }, [])

  const closeCookieSettings = useCallback(() => {
    if (cookieSubmitting) return
    setSettingsOpen(false)
    setCookieKey('')
  }, [cookieSubmitting])

  const closePasswordModal = useCallback(() => {
    if (passwordChecking) return
    setPasswordOpen(false)
    setSettingsPassword('')
  }, [passwordChecking])

  const verifySettingsPassword = useCallback(async () => {
    if (!settingsPassword) { message.warning('请输入密码'); return }
    setPasswordChecking(true)
    try {
      const derived = await pbkdf2Async(sha256, settingsPassword, settingsPasswordSalt, {
        c: settingsPasswordIterations,
        dkLen: 32,
        asyncTick: 8,
      })
      if (bytesToHex(derived) !== settingsPasswordHash) {
        setSettingsPassword('')
        message.error('密码错误')
        return
      }
      setPasswordOpen(false)
      setSettingsPassword('')
      setCookieKey('')
      setSettingsOpen(true)
    } finally {
      setPasswordChecking(false)
    }
  }, [message, settingsPassword])

  const submitCookie = useCallback(async () => {
    const key = cookieKey.trim()
    if (!key) { message.warning('请输入 key'); return }
    const input = `${key}${cookieSuffix}`
    setCookieSubmitting(true)
    try {
      const output = await resetNeteaseCookie(input)
      setSettingsOpen(false)
      setCookieKey('')
      setCookieResult({ input, output })
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '刷新 Cookie 失败')
    } finally {
      setCookieSubmitting(false)
    }
  }, [cookieKey, message])

  const playMusic = async (item: JsonRecord) => {
    const id = idText(item.id)
    if (!id || resolvingId) return
    setResolvingId(id)
    try {
      const data = await resolveNeteaseMusic(id)
      const sources = collectNeteasePlaybackSources(data)
      const key = saveMusicPlayback('netease', data, sources)
      navigate(`/music/player?key=${encodeURIComponent(key)}&from=netease`)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '网易云歌曲解析失败')
    } finally {
      setResolvingId('')
    }
  }

  const playMv = async (item: JsonRecord) => {
    const id = idText(item.id)
    if (!id || resolvingId) return
    setResolvingId(id)
    try {
      const data = await resolveNeteaseMv(id)
      const route = legacyPreviewRoute(data.mock_preview_path)
      if (!route) throw new Error('网易云 MV 未返回可播放地址')
      navigate(route)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '网易云 MV 解析失败')
    } finally {
      setResolvingId('')
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="NETEASE MUSIC"
        title="网易云音乐搜索"
        description="搜索网易云单曲与 MV，并支持继续解析播放。"
        extra={<Button icon={<SettingOutlined />} onClick={() => { setSettingsPassword(''); setPasswordOpen(true) }}>设置</Button>}
      />
      <Card className="search-panel netease-search-panel">
        <Segmented
          className="netease-type-tabs"
          value={type}
          onChange={(value) => {
            const nextType = value as NeteaseSearchType
            selectedTypeRef.current = nextType
            setType(nextType)
            setRows([])
            setTotal(0)
            setHasMore(false)
            setResult(null)
            setError('')
            if ((searchedKeyword || keyword).trim()) void search(searchedKeyword || keyword, 1, limit, nextType, false)
          }}
          options={searchTypes.map((item) => ({ label: item.label, value: item.value }))}
        />
        <Input.Search
          size="large"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={(value) => void search(value, 1, limit, selectedTypeRef.current)}
          enterButton={loading ? <span className="search-button-label">搜索</span> : <><SearchOutlined /><span className="search-button-label">搜索</span></>}
          placeholder="输入歌曲或 MV 关键词"
          loading={loading}
          allowClear
        />
        <Space wrap className="suggestions">
          <Typography.Text type="secondary">快捷输入</Typography.Text>
          {examples.map((item) => <Tag key={item} onClick={() => setKeyword(item)}>{item}</Tag>)}
        </Space>
      </Card>

      {loading && <div className="loading-panel"><Spin size="large" /><Typography.Text type="secondary">正在搜索网易云音乐…</Typography.Text></div>}
      {error && <Alert className="page-feedback" type="error" showIcon closable message="搜索失败" description={error} onClose={() => setError('')} />}
      {result && !loading && (
        <div className="result-section">
          <NeteaseSearchTemplate
            type={type}
            history={history}
            rows={rows}
            total={total}
            hasMore={hasMore}
            loadingMore={loadingMore}
            resolvingId={resolvingId}
            onLoadMore={loadMore}
            onPlay={(item) => void (type === '1004' ? playMv(item) : playMusic(item))}
            onSelectHistoryItem={selectHistoryItem}
            onSearchHistoryItem={searchFromHistory}
            onClearHistory={clearHistory}
          />
        </div>
      )}
      {!result && !loading && !error && (
        <NeteaseHistoryCard
          history={history}
          className="history-card netease-template-card"
          onSelectHistoryItem={selectHistoryItem}
          onSearchHistoryItem={searchFromHistory}
          onClearHistory={clearHistory}
        />
      )}

      <Modal title="验证密码" open={passwordOpen} footer={null} onCancel={closePasswordModal} maskClosable={!passwordChecking} closable={!passwordChecking}>
        <Form layout="vertical" onFinish={() => void verifySettingsPassword()}>
          <Form.Item label="密码" required>
            <Input.Password value={settingsPassword} onChange={(event) => setSettingsPassword(event.target.value)} disabled={passwordChecking} autoComplete="current-password" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={passwordChecking}>确认</Button>
        </Form>
      </Modal>

      <Modal title="网易云 Cookie 设置" open={settingsOpen} footer={null} onCancel={closeCookieSettings} maskClosable={!cookieSubmitting} closable={!cookieSubmitting}>
        <Form layout="vertical" className="netease-cookie-form" onFinish={() => void submitCookie()}>
          <Form.Item label="key" required>
            <Input.TextArea value={cookieKey} onChange={(event) => setCookieKey(event.target.value)} autoSize={{ minRows: 6, maxRows: 12 }} disabled={cookieSubmitting} autoComplete="off" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={cookieSubmitting}>提交</Button>
        </Form>
      </Modal>

      <Modal title="网易云 Cookie 刷新结果" open={Boolean(cookieResult)} onCancel={() => setCookieResult(null)} footer={<Button type="primary" onClick={() => setCookieResult(null)}>关闭</Button>}>
        <Form layout="vertical" className="netease-cookie-result">
          <Form.Item label="input">
            <Input.TextArea value={cookieResult?.input || ''} autoSize={{ minRows: 4, maxRows: 10 }} readOnly />
          </Form.Item>
          <Form.Item label="output">
            <Input.TextArea value={cookieResult?.output || ''} autoSize={{ minRows: 4, maxRows: 10 }} readOnly />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
