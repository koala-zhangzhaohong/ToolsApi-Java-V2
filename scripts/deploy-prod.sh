#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> 构建并打包 docker 版本"
"${ROOT_DIR}/scripts/package-docker.sh"

echo "==> 部署到生产环境"
"${ROOT_DIR}/scripts/deploy-gateway.sh"

echo "==> ToolsApi 生产上线完成"
