# Tools-Java
支持蓝奏云&抖音解析&网易云解析

## 独立前端

前端页面已拆分到 [`tools-frontend`](./tools-frontend)，使用 React、TypeScript、Vite 和 Ant Design。开发与部署方式见 [`tools-frontend/README.md`](./tools-frontend/README.md)。

## 接口说明文档
链接: https://www.apifox.cn/apidoc/shared-2c36a3d6-9259-45fe-8e36-5f0e7f35bdd3  
访问密码 : FLG7j9OP 

## 服务监控面板
https://github.com/zhangzhaohong/SpringBootAdminServer
已支持docker

## Docker 生产上线

使用 `scripts/deploy-prod.sh` 可一次完成前后端镜像构建、打包和远端部署。脚本会在构建期间临时切换到 `docker` Spring profile，退出时自动恢复 `application.properties` 原配置。

```bash
DEPLOY_PASSWORD='服务器密码' scripts/deploy-prod.sh
```

生产 Compose 会启动 5 个后端容器和 2 个前端容器：`traefik-middleware-multiple-1~5`、`traefik-middleware-web-multiple-1~2`。Traefik 动态配置中的后端服务名为 `tools-api`，前端服务名为 `tools-api-web`。

## 签名程序
抖音 X-Bogus、A-Bogus、直播 X-Bogus 已迁移到后端 JVM 内，由 GraalJS 执行，不再依赖 `signature_web_project` HTTP 服务。
酷狗 MD5、网易云 WEAPI/EAPI 和蓝奏云 ACW 也已迁移为 Java 本地实现。`signature_web_project` 仅保留作为历史参考，运行时不再依赖它。

## ES DOCKER
https://github.com/zhangzhaohong/es-server-docker

## KAFKA DOCKER
https://github.com/zhangzhaohong/kafka-docker

## 配套安卓客户端框架
https://github.com/zhangzhaohong/SAndroid
