import { ClearOutlined, CodeOutlined, CopyOutlined, FormatPainterOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Input, Space, Tag, Typography } from 'antd'
import { useState } from 'react'
import JsonTree from '../components/JsonTree'

const sample = '{\n  "hello": "Tools API",\n  "features": ["format", "tree", "copy"]\n}'

export default function LegacyJsonPage() {
  const { message } = App.useApp()
  const [source, setSource] = useState(sample)
  const [data, setData] = useState<unknown>(JSON.parse(sample))
  const [error, setError] = useState('')
  const format = () => {
    try { const parsed = JSON.parse(source) as unknown; setData(parsed); setSource(JSON.stringify(parsed, null, 2)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'JSON 格式错误') }
  }
  const copy = async () => { await navigator.clipboard.writeText(source); message.success('JSON 已复制') }
  return <main className="legacy-json-page"><header><Space><CodeOutlined /><Tag color="purple">JSON TOOL</Tag></Space><Typography.Title>JSON 格式化与预览</Typography.Title><Typography.Paragraph>使用 Ant Design 工作区粘贴、格式化并浏览 JSON 层级结构。</Typography.Paragraph></header>{error && <Alert className="legacy-json-alert" type="error" showIcon closable message="无法解析 JSON" description={error} onClose={() => setError('')} />}<div className="legacy-json-grid"><Card title="原始数据" extra={<Space><Button icon={<ClearOutlined />} onClick={() => { setSource(''); setData(null); setError('') }}>清空</Button><Button icon={<CopyOutlined />} onClick={() => void copy()}>复制</Button><Button type="primary" icon={<FormatPainterOutlined />} onClick={format}>格式化</Button></Space>}><Input.TextArea value={source} onChange={(event) => setSource(event.target.value)} onPressEnter={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') format() }} placeholder="粘贴 JSON，按 Ctrl/⌘ + Enter 格式化" /></Card><Card title="结构预览" extra={<Tag color={error ? 'error' : 'success'}>{error ? '格式错误' : '有效 JSON'}</Tag>}><JsonTree data={data} /></Card></div></main>
}
