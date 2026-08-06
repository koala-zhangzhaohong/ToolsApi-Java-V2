import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function ErrorPage({ status }: { status: 403 | 404 | 500 }) {
  const navigate = useNavigate()
  const messages = {
    403: ['没有访问权限', '当前账号或网络无权访问此页面。'],
    404: ['页面不存在', '你访问的地址可能已迁移或输入有误。'],
    500: ['服务出现异常', '服务暂时无法完成请求，请稍后重试。'],
  }
  return <Result status={status} title={status} subTitle={`${messages[status][0]}：${messages[status][1]}`} extra={<Button type="primary" onClick={() => navigate('/')}>返回工作台</Button>} />
}
