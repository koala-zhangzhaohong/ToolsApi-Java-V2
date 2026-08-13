import { DownloadOutlined } from '@ant-design/icons'
import { message, Tooltip } from 'antd'
import type { ReactElement, ReactNode } from 'react'
import { cloneElement } from 'react'

function imageFileName(url: string, contentType: string) {
  const extensionByType: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  }
  try {
    const pathname = new URL(url, window.location.origin).pathname
    const sourceName = decodeURIComponent(pathname.split('/').pop() || '')
    if (/\.[a-z0-9]{2,5}$/i.test(sourceName)) return sourceName
  } catch { /* use a generated name */ }
  const extension = extensionByType[contentType.split(';')[0].toLowerCase()] || 'jpg'
  return `image-${Date.now()}.${extension}`
}

async function downloadImage(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = imageFileName(url, blob.type)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    message.error('图片下载失败，请稍后重试')
  }
}

export function imagePreviewToolbar(originalNode: ReactElement, info: { image: { url: string } }) {
  const toolbarNode = originalNode as ReactElement<{ children?: ReactNode }>
  const children = toolbarNode.props.children
  return cloneElement(toolbarNode, {}, [
    children,
    <li
      key="download"
      className="ant-image-preview-operations-operation image-preview-download"
      role="button"
      tabIndex={0}
      onClick={() => void downloadImage(info.image.url)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void downloadImage(info.image.url)
        }
      }}
    >
      <Tooltip title="下载当前图片"><DownloadOutlined /></Tooltip>
    </li>,
  ])
}
