import {
  ClearOutlined,
  CustomerServiceOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Empty, Input, List, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useProgressiveRows } from '../hooks/useProgressiveRows'
import { collectKugouPlaybackOptions, saveMusicPlayback } from '../services/musicPlayback'
import { resolveKugouMusic, resolveKugouMv, searchKugou, type KugouSearchPayload, type KugouSearchType } from '../services/kugou'
import type { JsonRecord } from '../types'
import { legacyPreviewRoute } from '../utils/legacyPreview'
import { clearMusicSearchState, readMusicSearchState, saveMusicSearchState } from '../utils/musicSearchState'

const historyKey = 'tools-frontend:kugou-search-history'
const historyChangedEvent = 'tools-frontend:kugou-search-history-change'
const maxHistorySize = 8
const pageSize = 20
const examples = ['周杰伦', '晴天', '林俊杰', '起风了']
const searchTypes: Array<{ label: string; value: KugouSearchType }> = [
  { label: '单曲', value: 'song' },
  { label: 'MV', value: 'mv' },
]

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

function useKugouSearchHistory() {
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

function formatDuration(value: unknown) {
  const duration = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(duration) || duration <= 0) return ''
  const minute = Math.floor(duration / 60)
  return `${minute}:${String(Math.round(duration % 60)).padStart(2, '0')}`
}

function coverUrl(value: unknown) {
  const url = text(value)
  return url ? url.replace('{size}', '240') : ''
}

function resultTitle(item: JsonRecord, type: KugouSearchType) {
  return text(type === 'mv' ? item.MvName : item.SongName, text(item.FileName, type === 'mv' ? '未命名 MV' : '未命名歌曲'))
}

function resultDescription(item: JsonRecord, type: KugouSearchType) {
  if (type === 'mv') {
    return [text(item.SingerName, '未知歌手'), text(item.MvHashMark), formatDuration(item.Duration)].filter(Boolean).join(' · ')
  }
  return [text(item.SingerName, '未知歌手'), text(item.AlbumName, '未知专辑'), formatDuration(item.Duration)].filter(Boolean).join(' · ')
}

function resultCover(item: JsonRecord, type: KugouSearchType) {
  if (type === 'mv') return text(item.ThumbGif) || text(item.ThumbMp4)
  return coverUrl(item.Image) || coverUrl(record(item.trans_param)?.union_cover)
}

function resultHash(item: JsonRecord, type: KugouSearchType) {
  return idText(type === 'mv' ? item.MvHash : item.FileHash)
}

function resultAlbumId(item: JsonRecord) {
  return idText(item.AlbumID || item.albumId || item.album_id)
}

function resultId(item: JsonRecord, type: KugouSearchType) {
  return idText(type === 'mv' ? item.MvID : (item.MixSongID || item.ID || item.SongID))
}

function resultUrl(item: JsonRecord, type: KugouSearchType) {
  if (type === 'mv') {
    const id = resultId(item, type)
    return id ? `https://www.kugou.com/mv/${id}/` : ''
  }
  const hash = resultHash(item, type)
  if (!hash) return ''
  const albumId = resultAlbumId(item)
  const params = new URLSearchParams({ hash })
  if (albumId) params.set('album_id', albumId)
  return `https://www.kugou.com/song/#${params.toString()}`
}

interface KugouHistoryCardProps {
  history: string[]
  className?: string
  onSelectHistoryItem: (value: string) => void
  onSearchHistoryItem: (value: string) => void
  onClearHistory: () => void
}

function KugouHistoryCard({
  history,
  className = 'legacy-section-card netease-template-card',
  onSelectHistoryItem,
  onSearchHistoryItem,
  onClearHistory,
}: KugouHistoryCardProps) {
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

interface SearchTemplateProps {
  type: KugouSearchType
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
  restoredRowCount: number
}

function KugouSearchTemplate({
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
  restoredRowCount,
}: SearchTemplateProps) {
  const { visibleRows, sentinelRef, hasHiddenRows } = useProgressiveRows(rows, hasMore, onLoadMore, restoredRowCount)
  const footerText = hasHiddenRows
    ? `已显示 ${visibleRows.length} / ${rows.length} 条，继续向下滚动显示更多`
    : hasMore ? '继续向下滚动以加载更多内容' : `已加载全部 ${rows.length} 条结果`

  return (
    <Space direction="vertical" size={20} className="full-width">
      <KugouHistoryCard history={history} onSelectHistoryItem={onSelectHistoryItem} onSearchHistoryItem={onSearchHistoryItem} onClearHistory={onClearHistory} />

      <Card
        title={<Space>{type === 'mv' ? <VideoCameraOutlined /> : <CustomerServiceOutlined />} 搜索结果</Space>}
        className="legacy-section-card netease-template-card"
        extra={<Typography.Text type="secondary">共 {total} 条</Typography.Text>}
      >
        {rows.length ? (
          <>
            <List
              className="netease-result-list"
              dataSource={visibleRows}
              renderItem={(item) => {
                const hash = resultHash(item, type)
                const albumId = resultAlbumId(item)
                const cover = resultCover(item, type)
                const external = resultUrl(item, type)
                const id = resultId(item, type)
                const canPlay = Boolean(hash && (type === 'mv' || albumId))
                return (
                  <List.Item
                    actions={[
                      canPlay ? <Button key="play" type="primary" icon={<PlayCircleOutlined />} loading={resolvingId === hash} onClick={() => onPlay(item)}>解析播放</Button> : null,
                      external ? <Button key="external" icon={<LinkOutlined />} href={external} target="_blank">酷狗</Button> : null,
                      hash ? <Button key="api" href={`/json?url=${encodeURIComponent(type === 'mv' ? `/tools/Kugou/api/mv/detail?hash=${encodeURIComponent(hash)}&generateInfo=true` : `/tools/Kugou/api?hash=${encodeURIComponent(hash)}&albumId=${encodeURIComponent(albumId)}&type=info`)}`}>接口数据</Button> : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={cover ? <img className="netease-cover" src={cover} alt="" loading="lazy" decoding="async" /> : <span className="netease-cover netease-cover-placeholder">{type === 'mv' ? <VideoCameraOutlined /> : <CustomerServiceOutlined />}</span>}
                      title={<Typography.Text strong>{resultTitle(item, type)}</Typography.Text>}
                      description={<Space direction="vertical" size={3}><Typography.Text type="secondary">{resultDescription(item, type)}</Typography.Text>{id && <Typography.Text type="secondary">ID：{id}</Typography.Text>}</Space>}
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

export default function KugouPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const shouldRestoreRef = useRef(record(location.state)?.restoreMusicSearch === 'kugou')
  const shouldRestore = shouldRestoreRef.current
  const restoredStateRef = useRef(shouldRestore
    ? readMusicSearchState<KugouSearchType, KugouSearchPayload>('kugou')
    : null)
  const restoredState = restoredStateRef.current
  const [keyword, setKeyword] = useState(restoredState?.keyword || '')
  const [type, setType] = useState<KugouSearchType>(restoredState?.type || 'song')
  const [limit, setLimit] = useState(restoredState?.limit || pageSize)
  const [searchedKeyword, setSearchedKeyword] = useState(restoredState?.searchedKeyword || '')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [resolvingId, setResolvingId] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<KugouSearchPayload | null>(restoredState?.result || null)
  const [rows, setRows] = useState<JsonRecord[]>(restoredState?.rows || [])
  const [total, setTotal] = useState(restoredState?.total || 0)
  const [hasMore, setHasMore] = useState(restoredState?.hasMore || false)
  const { history, addHistory, clearHistory } = useKugouSearchHistory()
  const searchSessionRef = useRef(0)
  const latestParamsRef = useRef({ keyword: restoredState?.searchedKeyword || '', type: restoredState?.type || 'song' as KugouSearchType, page: restoredState?.page || 1, limit: restoredState?.limit || pageSize })
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (!shouldRestore) {
      clearMusicSearchState('kugou')
      return
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    if (!restoredState) return
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo({ top: restoredState.scrollY, behavior: 'auto' }))
    })
    return () => cancelAnimationFrame(firstFrame)
  }, [location.pathname, location.search, navigate, restoredState, shouldRestore])

  const saveSearchPosition = () => {
    const current = latestParamsRef.current
    saveMusicSearchState('kugou', {
      keyword,
      searchedKeyword,
      type,
      limit,
      result,
      rows,
      total,
      hasMore,
      page: current.page,
      scrollY: window.scrollY,
    })
  }

  const search = useCallback(async (value = keyword, nextPage = 1, nextLimit = limit, nextType = type, append = false) => {
    const input = value.trim()
    if (!input) { message.warning('请先输入酷狗搜索关键词'); return }
    const sessionId = append ? searchSessionRef.current : ++searchSessionRef.current
    if (append) {
      if (loading || loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
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
      const data = await searchKugou(input, nextType, nextPage, nextLimit)
      if (sessionId !== searchSessionRef.current) return
      const root = record(data.data)
      const pageRows = recordList(root?.lists)
      const nextTotal = Number(root?.total || pageRows.length || 0)
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
      const raw = reason instanceof Error ? reason.message : '酷狗搜索失败'
      setError(/请求失败（5\d\d）/.test(raw) ? '酷狗后端暂未启动或接口异常，请确认本地 8080 已运行后重试。' : raw)
    } finally {
      if (sessionId === searchSessionRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
      if (append && sessionId === searchSessionRef.current) loadingMoreRef.current = false
    }
  }, [addHistory, keyword, limit, loading, message, type])

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

  const playMusic = async (item: JsonRecord) => {
    const hash = resultHash(item, 'song')
    const albumId = resultAlbumId(item)
    if (!hash || !albumId || resolvingId) return
    setResolvingId(hash)
    try {
      const data = await resolveKugouMusic(hash, albumId)
      const options = await collectKugouPlaybackOptions(data)
      if (!options.length) throw new Error('酷狗歌曲已解析，但没有返回可播放地址，可能受版权限制')
      const key = saveMusicPlayback('kugou', data, options.map((option) => option.source), options.map((option) => option.label))
      saveSearchPosition()
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { restoreMusicSearch: 'kugou' } })
      navigate(`/music/player?key=${encodeURIComponent(key)}&from=kugou`)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '酷狗歌曲解析失败')
    } finally {
      setResolvingId('')
    }
  }

  const playMv = async (item: JsonRecord) => {
    const hash = resultHash(item, 'mv')
    if (!hash || resolvingId) return
    setResolvingId(hash)
    try {
      const data = await resolveKugouMv(hash)
      const route = legacyPreviewRoute(data.mock_preview_path)
      if (!route) throw new Error('酷狗 MV 未返回可播放地址')
      saveSearchPosition()
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { restoreMusicSearch: 'kugou' } })
      navigate(route)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '酷狗 MV 解析失败')
    } finally {
      setResolvingId('')
    }
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="KUGOU MUSIC" title="酷狗音乐搜索" description="搜索酷狗单曲与 MV，单曲和 MV 均可继续解析播放。" />
      <Card className="search-panel netease-search-panel">
        <Segmented
          className="netease-type-tabs"
          value={type}
          onChange={(value) => {
            const nextType = value as KugouSearchType
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
          onSearch={(value) => void search(value, 1, limit)}
          enterButton={loading ? <span className="search-button-label">搜索</span> : <span className="search-button-content"><SearchOutlined /><span className="search-button-label">搜索</span></span>}
          placeholder="输入歌名、歌手或 MV 关键词"
          loading={loading}
          allowClear
        />
        <Space wrap className="suggestions">
          <Typography.Text type="secondary">快捷输入</Typography.Text>
          {examples.map((item) => <Tag key={item} onClick={() => setKeyword(item)}>{item}</Tag>)}
        </Space>
      </Card>

      {loading && <div className="loading-panel"><Spin size="large" /><Typography.Text type="secondary">正在搜索酷狗音乐…</Typography.Text></div>}
      {error && <Alert className="page-feedback" type="error" showIcon closable message="搜索失败" description={error} onClose={() => setError('')} />}
      {result && !loading && (
        <div className="result-section">
          <KugouSearchTemplate
            type={type}
            history={history}
            rows={rows}
            total={total}
            hasMore={hasMore}
            loadingMore={loadingMore}
            resolvingId={resolvingId}
            onLoadMore={loadMore}
            onPlay={(item) => void (type === 'mv' ? playMv(item) : playMusic(item))}
            onSelectHistoryItem={selectHistoryItem}
            onSearchHistoryItem={searchFromHistory}
            onClearHistory={clearHistory}
            restoredRowCount={restoredState?.rows.length || 0}
          />
        </div>
      )}
      {!result && !loading && !error && (
        <KugouHistoryCard
          history={history}
          className="history-card netease-template-card"
          onSelectHistoryItem={selectHistoryItem}
          onSearchHistoryItem={searchFromHistory}
          onClearHistory={clearHistory}
        />
      )}
    </div>
  )
}
