# Tools Frontend

从 `tools-web/src/main/resources/templates` 拆分出的独立前端项目，使用 React、TypeScript、Vite 和 Ant Design。

## 页面对应关系

| 新页面 | 原模板/路由 | 说明 |
| --- | --- | --- |
| `/douyin` | `/tools/DouYin/web/v2/searcher`、tiktok 模板 | Ant Design 搜索、反馈、解析详情、线路和历史记录 |
| `/json` | `/tools/json/printer*`、json 模板 | Ant Design JSON 编辑、校验、树形预览、复制和格式化 |
| `/player` | music/video/live/picture 模板 | 视频、音频、HLS/FLV、图片及多线路播放器；旧版本由独立沉浸式页面接管 |
| `/error/403` 等 | 403/404/500 模板 | Ant Design Result、返回和重试操作 |

旧的搜索、JSON 和播放器 URL 也注册了兼容路由。直接媒体 URL 页面会读取原有的 URL-safe Base64 `path`/`title` 参数；携带 Redis `key` 的 `/short` 页面通过页面数据 API 获取媒体元数据，并使用 Ant Design 的加载、过期、错误及线路状态提示。27 个 Thymeleaf 模板的完整映射见 [`TEMPLATE_MIGRATION.md`](./TEMPLATE_MIGRATION.md)。

## 本地开发

需要 Node.js 18+ 和 pnpm：

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

默认开发地址为 `http://localhost:5173`，后端代理目标为 `http://localhost:8080`。可在 `.env.local` 中修改：

```dotenv
VITE_DEV_PROXY_TARGET=http://localhost:8080
```

## 生产构建

```bash
pnpm build
```

构建结果位于 `dist`。前后端分域部署时设置：

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

后端需要允许前端部署域名进行 CORS 请求。Web 服务器还应把未命中静态文件的页面请求回退到 `index.html`，以支持 BrowserRouter。

Nginx 示例：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
