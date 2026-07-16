#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application.properties"
APP_DOCKER_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application-docker.properties"
GATEWAY_FILE="${ROOT_DIR}/DockerFile-gateway.yml"

DEPLOY_HOST="${DEPLOY_HOST:-116.255.208.81}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/www/docker/tools-api-gateway}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:-}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_DOCKER_PROPERTIES}" | tr -d '[:space:]')"
if [[ -z "${VERSION_BASE}" ]]; then
  VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_PROPERTIES}" | tr -d '[:space:]')"
fi
if [[ -z "${VERSION_BASE}" ]]; then
  echo "无法从 ${APP_DOCKER_PROPERTIES} 或 ${APP_PROPERTIES} 读取 spring.application.version.base" >&2
  exit 1
fi
IMAGE_NAME="tools-api-package:${VERSION_BASE}-docker"
IMAGE_ARCHIVE="/tmp/tools-api-package-${VERSION_BASE}-docker.tar.gz"

if [[ -z "${DEPLOY_PASSWORD}" ]]; then
  echo "请通过 DEPLOY_PASSWORD 环境变量传入 SSH 密码" >&2
  exit 1
fi

if ! command -v expect >/dev/null 2>&1; then
  echo "未找到 expect，无法自动输入 SSH 密码" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先安装 Docker 或配置 PATH" >&2
  exit 1
fi

if ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  echo "未找到本地镜像 ${IMAGE_NAME}，请先执行 scripts/package-docker.sh" >&2
  exit 1
fi

IMAGE_PLATFORM="$(docker image inspect "${IMAGE_NAME}" --format '{{.Os}}/{{.Architecture}}')"
if [[ "${IMAGE_PLATFORM}" != "${DOCKER_PLATFORM}" ]]; then
  echo "本地镜像架构不匹配: ${IMAGE_PLATFORM}, 期望: ${DOCKER_PLATFORM}，请重新执行 scripts/package-docker.sh" >&2
  exit 1
fi

run_ssh() {
  local remote_command="$1"
  local escaped_command
  escaped_command="$(printf '%s' "${remote_command}" | sed "s/'/'\\\\''/g")"
  expect <<EOF
set timeout -1
set password \$env(DEPLOY_PASSWORD)
spawn ssh -p ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${DEPLOY_HOST} -- bash -lc '${escaped_command}'
expect {
  -re "(?i)password:" {
    send -- "\$password\r"
    exp_continue
  }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF
}

run_scp() {
  local source_file="$1"
  local target_path="$2"
  expect <<EOF
set timeout -1
set password \$env(DEPLOY_PASSWORD)
spawn scp -O -P ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new "${source_file}" ${DEPLOY_USER}@${DEPLOY_HOST}:${target_path}
expect {
  -re "(?i)password:" {
    send -- "\$password\r"
    exp_continue
  }
  eof
}
catch wait result
exit [lindex \$result 3]
EOF
}

load_local_image_to_remote() {
  local remote_archive="${DEPLOY_DIR}/$(basename "${IMAGE_ARCHIVE}")"

  echo "生成本地镜像压缩包 ${IMAGE_ARCHIVE}"
  docker save "${IMAGE_NAME}" | gzip -1 > "${IMAGE_ARCHIVE}"

  echo "上传镜像压缩包 ${remote_archive}"
  run_scp "${IMAGE_ARCHIVE}" "${remote_archive}"

  echo "导入远端 Docker 镜像 ${IMAGE_NAME}"
  run_ssh "if docker image inspect '${IMAGE_NAME}' >/dev/null 2>&1; then docker tag '${IMAGE_NAME}' 'tools-api-package:previous-${VERSION_BASE}-docker' || true; fi; gzip -dc '${remote_archive}' | docker load"
}

cleanup_remote_old_images() {
  local remote_archive="${DEPLOY_DIR}/$(basename "${IMAGE_ARCHIVE}")"

  echo "清理远端旧版本 tools-api 镜像"
  run_ssh "set -e; \
current_image='${IMAGE_NAME}'; \
used_image_count=\$(docker ps --filter \"ancestor=\${current_image}\" --format '{{.ID}}' | wc -l | tr -d ' '); \
if [ \"\${used_image_count}\" = '0' ]; then \
  echo \"当前镜像未被运行中的容器使用，跳过旧镜像清理: \${current_image}\" >&2; \
  exit 1; \
fi; \
old_images=\$(docker images 'tools-api-package' --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk -v current=\"\${current_image}\" '\$1 != current && \$1 ~ /-docker$/ {print \$1}' | sort -u); \
if [ -n \"\${old_images}\" ]; then \
  echo \"\${old_images}\" | xargs -r docker rmi; \
else \
  echo '没有需要清理的旧 tools-api 镜像'; \
fi; \
rm -f '${remote_archive}'"
}

echo "创建远端部署目录 ${DEPLOY_DIR}"
run_ssh "mkdir -p '${DEPLOY_DIR}'"

echo "导入本地镜像到服务器 ${IMAGE_NAME}"
load_local_image_to_remote

echo "上传 DockerFile-gateway.yml"
run_scp "${GATEWAY_FILE}" "${DEPLOY_DIR}/DockerFile-gateway.yml"

echo "执行 docker compose 部署"
run_ssh "set -e; cd '${DEPLOY_DIR}'; if command -v docker-compose >/dev/null 2>&1; then COMPOSE='docker-compose'; elif docker compose version >/dev/null 2>&1; then COMPOSE='docker compose'; else echo '未找到 docker compose 或 docker-compose' >&2; exit 1; fi; \${COMPOSE} -f DockerFile-gateway.yml config --quiet; docker rm -f traefik-otel-lgtm traefik-gateway-v1 traefik-middleware-multiple-1 traefik-middleware-multiple-2 traefik-middleware-multiple-3 2>/dev/null || true; \${COMPOSE} -f DockerFile-gateway.yml up -d"

cleanup_remote_old_images

echo "线上部署完成"
