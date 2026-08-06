import { ClearOutlined, HistoryOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Empty, Input, List, Space, Spin, Tag, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { douyinExamples } from '../constants/douyinExamples'
import { useParseHistory } from '../hooks/useParseHistory'
import { parseDouyinShare } from '../services/douyin'
import type { DouyinResult } from '../types'

function friendlyError(reason: unknown, input: string) {
  const raw = reason instanceof Error ? reason.message : '解析失败'
  if (/GET_INFO_ERROR/i.test(raw)) {
    return /直播|正在直播/.test(input)
      ? '直播间可能已经结束，或抖音暂时没有返回完整的主播和流信息。请换一个正在直播的分享链接重试。'
      : '抖音暂时没有返回完整内容，请确认分享链接仍然有效后重试。'
  }
  return raw
}

export default function LegacySearchPage() {
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const version = params.get('version') || '2'
  const [value, setValue] = useState('')
  const [result, setResult] = useState<DouyinResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { history, addHistory, clearHistory } = useParseHistory()

  const search = async (candidate = value) => {
    const input = candidate.trim()
    if (!input) { message.warning('请先粘贴分享内容或链接'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const { result: data, proPath } = await parseDouyinShare(input)
      addHistory(input)
      if (proPath) {
        navigate(proPath, { state: { data, parseInput: input } })
        return
      }
      setResult(data)
    } catch (reason) { setError(friendlyError(reason, input)) } finally { setLoading(false) }
  }

  const searchBox = <>
    <Input.Search value={value} onChange={(event) => setValue(event.target.value)} onSearch={(input) => void search(input)} enterButton={<><SearchOutlined /> 立即解析</>} size="large" allowClear loading={loading} placeholder="粘贴完整的抖音分享文本或链接" />
    <Space wrap className="legacy-search-chips"><Typography.Text type="secondary">快捷输入</Typography.Text>{douyinExamples.map((item) => <Tag key={item.label} onClick={() => setValue(item.value)}>{item.label}</Tag>)}</Space>
  </>

  if (version === '1') return <main className="legacy-search-v1"><Card className="search-v1-box" bordered={false}><Typography.Text className="eyebrow">DOUYIN PARSER V1</Typography.Text><Typography.Title>短视频解析</Typography.Title><Typography.Paragraph type="secondary">粘贴抖音分享链接，获取对应媒体资源。</Typography.Paragraph>{searchBox}{loading && <Spin tip="正在解析"><div className="legacy-search-spin" /></Spin>}{error && <Alert type="error" showIcon closable message="解析失败" description={error} onClose={() => setError('')} />}</Card></main>

  return <main className="legacy-search-v2">
    <Card className="search-v2-hero" bordered={false}><Typography.Text>TOOLS · DOUYIN</Typography.Text><Typography.Title>发现内容，解析精彩</Typography.Title><Typography.Paragraph>支持视频、直播、图集与音乐分享</Typography.Paragraph>{searchBox}</Card>
    {loading && <Card className="legacy-search-loading" bordered={false}><Spin size="large" tip="正在连接抖音并读取内容"><div className="legacy-search-spin" /></Spin></Card>}
    {error && <Alert className="legacy-search-feedback" type="error" showIcon closable message="解析失败" description={error} action={<Button onClick={() => void search()}>重试</Button>} onClose={() => setError('')} />}
    {result && <Card className="legacy-search-result" title={<Space><LinkOutlined />解析成功</Space>}><Typography.Title level={3}>{result.desc || result.title || '内容解析成功'}</Typography.Title><Space wrap><Button type="primary" onClick={() => navigate('/tools/json/printer/pro?id=6', { state: { data: result } })}>查看详情</Button><Button onClick={() => navigate('/tools/json/printer/pro?id=5', { state: { data: result } })}>查看 JSON</Button></Space></Card>}
    <Card title={<Space><HistoryOutlined />最近解析</Space>} extra={history.length > 0 && <Button type="text" danger icon={<ClearOutlined />} onClick={clearHistory}>清空</Button>} className="legacy-search-history">{history.length ? <List dataSource={history} renderItem={(item) => <List.Item actions={[<Button type="link" onClick={() => { setValue(item); void search(item) }}>再次解析</Button>]}><Typography.Text ellipsis={{ tooltip: item }}>{item}</Typography.Text></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无记录" />}</Card>
  </main>
}
