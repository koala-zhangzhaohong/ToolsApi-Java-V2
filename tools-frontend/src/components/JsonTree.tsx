import { CaretRightOutlined } from '@ant-design/icons'
import { Collapse, Typography } from 'antd'
import type { ReactNode } from 'react'

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="json-null">null</span>
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//i.test(value)
    return isUrl
      ? <a href={value} target="_blank" rel="noreferrer">&quot;{value}&quot;</a>
      : <span className="json-string">&quot;{value}&quot;</span>
  }
  if (typeof value === 'number') return <span className="json-number">{value}</span>
  if (typeof value === 'boolean') return <span className="json-boolean">{String(value)}</span>
  return <span>{String(value)}</span>
}

function Node({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || typeof value !== 'object') return <Primitive value={value} />
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value)
  const label = Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`
  if (!entries.length) return <span>{Array.isArray(value) ? '[]' : '{}'}</span>

  return (
    <Collapse
      ghost
      defaultActiveKey={depth < 2 ? ['node'] : []}
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      items={[{
        key: 'node',
        label: <Typography.Text type="secondary">{label}</Typography.Text>,
        children: (
          <div className="json-children">
            {entries.map(([key, item]) => (
              <div className="json-row" key={key}>
                <span className="json-key">{key}</span><span className="json-separator">:</span><Node value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        ),
      }]}
    />
  )
}

export default function JsonTree({ data }: { data: unknown }) {
  return <div className="json-tree"><Node value={data} /></div>
}
