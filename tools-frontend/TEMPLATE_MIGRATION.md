# Thymeleaf 模板迁移映射

原 `tools-web/src/main/resources/templates` 下的 27 个模板均由 React 路由接管。播放器模板通过平台、媒体类型和 `version` 参数选择独立页面模式，保留原短链参数格式。

| 原模板 | 新页面/模式 |
| --- | --- |
| `403/index.html` | `LegacyErrorPage` 403 |
| `404/index.html` | `LegacyErrorPage` 404 |
| `500/index.html` | `LegacyErrorPage` 500 |
| `json/index.html` | `LegacyJsonPage` |
| `json/pro/demo.html`（枚举路径 `json/pro/index`） | `LegacyResultPage` JSON Pro |
| `json/pro/tiktok/api/index.html` | `LegacyResultPage` 抖音详情 |
| `json/pro/tiktok/demo.html` | `LegacyResultPage` JSON 详情 |
| `json/pro/tiktok/ranklist/index.html` | `LegacyResultPage` 榜单 |
| `live/flvjs/index.html` | `LegacyPlayerPage` live v1 |
| `live/dplayer/index.html` | `LegacyPlayerPage` live v2 |
| `live/zwplayer/index.html` | `LegacyPlayerPage` live v3 |
| `music/dplayer/kugou/index.html` | `LegacyPlayerPage` Kugou music v1 |
| `music/h5/kugou/index.html` | `LegacyPlayerPage` Kugou music v2 高级播放器 |
| `music/h5/netease/index.html` | `LegacyPlayerPage` Netease music v2 高级播放器 |
| `music/plyr/kugou/index.html` | `LegacyPlayerPage` Kugou music v1 兼容模式 |
| `music/plyr/netease/index.html` | `LegacyPlayerPage` Netease music v1 |
| `music/plyr/tiktok/index.html` | `LegacyPlayerPage` DouYin music |
| `picture/index.html` | `LegacyPlayerPage` 图片轮播 |
| `tiktok/v1/index.html` | `LegacySearchPage` v1 |
| `tiktok/v2/index.html` | `LegacySearchPage` v2 |
| `video/video.js/index.html` | `LegacyPlayerPage` video v1 |
| `video/plyr/index.html` | `LegacyPlayerPage` video v2 |
| `video/dplayer/kugou/index.html` | `LegacyPlayerPage` Kugou video v1 |
| `video/dplayer/netease/index.html` | `LegacyPlayerPage` Netease video v1 |
| `video/dplayer/tiktok/index.html` | `LegacyPlayerPage` DouYin video v3 |
| `video/zwplayer/kugou/index.html` | `LegacyPlayerPage` Kugou video v2 |
| `video/zwplayer/netease/index.html` | `LegacyPlayerPage` Netease video v2 |
| `video/zwplayer/tiktok/index.html` | `LegacyPlayerPage` DouYin video v4 |

新前端只通过 HTTP API 读取数据，不再依赖 Thymeleaf model 注入。后端旧 URL 可以继续生成，Vite/生产网关需把以上页面路由回退到 `index.html`。
