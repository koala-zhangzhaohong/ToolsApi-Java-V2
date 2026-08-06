import { Space, Typography } from 'antd'
import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  description: string
  extra?: ReactNode
}

export default function PageHeader({ eyebrow, title, description, extra }: Props) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <Typography.Text className="eyebrow">{eyebrow}</Typography.Text>}
        <Typography.Title level={1}>{title}</Typography.Title>
        <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      </div>
      {extra && <Space>{extra}</Space>}
    </div>
  )
}
