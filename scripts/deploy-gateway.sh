#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DOCKER_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application-docker.properties"
GATEWAY_FILE="${ROOT_DIR}/DockerFile-gateway.yml"
DYNAMIC_CONFIG_FILE="${ROOT_DIR}/traefik-tools-api.yml"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/image-output}"

DEPLOY_HOST="${DEPLOY_HOST:-116.255.208.81}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/www/docker/tools-api-gateway}"
TRAEFIK_CONFIG_DIR="${TRAEFIK_CONFIG_DIR:-/www/docker/traefik/v1/config}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:-}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_DOCKER_PROPERTIES}" | tr -d '[:space:]')"
IMAGE_VERSION="${IMAGE_VERSION:-${VERSION_BASE}-docker}"
BACKEND_IMAGE="tools-api-package:${IMAGE_VERSION}"
FRONTEND_IMAGE="tools-api-web-package:${IMAGE_VERSION}"
BACKEND_ARCHIVE="${OUTPUT_DIR}/${BACKEND_IMAGE//:/-}.tar.gz"
FRONTEND_ARCHIVE="${OUTPUT_DIR}/${FRONTEND_IMAGE//:/-}.tar.gz"

if [[ -z "${DEPLOY_PASSWORD}" ]]; then
  read -r -s -p "请输入 SSH 密码: " DEPLOY_PASSWORD
  echo
fi
[[ -n "${DEPLOY_PASSWORD}" ]] || { echo "SSH 密码不能为空" >&2; exit 1; }
command -v sshpass >/dev/null 2>&1 || { echo "未找到 sshpass" >&2; exit 1; }
command -v scp >/dev/null 2>&1 || { echo "未找到 scp" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "未找到 docker" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon 未运行" >&2; exit 1; }

for file in "${GATEWAY_FILE}" "${DYNAMIC_CONFIG_FILE}"; do
  [[ -f "${file}" ]] || { echo "文件不存在: ${file}" >&2; exit 1; }
done
for image in "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}"; do
  docker image inspect "${image}" >/dev/null 2>&1 || {
    echo "未找到镜像 ${image}，请先执行 scripts/package-docker.sh" >&2
    exit 1
  }
  [[ "$(docker image inspect "${image}" --format '{{.Os}}/{{.Architecture}}')" == "${DOCKER_PLATFORM}" ]] || {
    echo "镜像架构不匹配: ${image}" >&2
    exit 1
  }
done

mkdir -p "${OUTPUT_DIR}"
[[ -f "${BACKEND_ARCHIVE}" ]] || docker save "${BACKEND_IMAGE}" | gzip -1 > "${BACKEND_ARCHIVE}"
[[ -f "${FRONTEND_ARCHIVE}" ]] || docker save "${FRONTEND_IMAGE}" | gzip -1 > "${FRONTEND_ARCHIVE}"

run_ssh() {
  local remote_command="$1"
  SSHPASS="${DEPLOY_PASSWORD}" sshpass -e ssh \
    -p "${DEPLOY_PORT}" \
    -o StrictHostKeyChecking=accept-new \
    -o ServerAliveInterval=20 \
    -o ServerAliveCountMax=30 \
    -o TCPKeepAlive=yes \
    "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "${remote_command}"
}

run_scp() {
  local source_file="$1"
  local target_path="$2"
  SSHPASS="${DEPLOY_PASSWORD}" sshpass -e scp \
    -P "${DEPLOY_PORT}" \
    -o StrictHostKeyChecking=accept-new \
    -o ServerAliveInterval=20 \
    -o ServerAliveCountMax=30 \
    -o TCPKeepAlive=yes \
    "${source_file}" "${DEPLOY_USER}@${DEPLOY_HOST}:${target_path}"
}

echo "创建远端目录 ${DEPLOY_DIR}"
run_ssh "mkdir -p '${DEPLOY_DIR}' '${TRAEFIK_CONFIG_DIR}'"

echo "上传前后端镜像压缩包"
run_scp "${BACKEND_ARCHIVE}" "${DEPLOY_DIR}/$(basename "${BACKEND_ARCHIVE}")"
run_scp "${FRONTEND_ARCHIVE}" "${DEPLOY_DIR}/$(basename "${FRONTEND_ARCHIVE}")"
run_scp "${GATEWAY_FILE}" "${DEPLOY_DIR}/DockerFile-gateway.yml.next"
run_scp "${DYNAMIC_CONFIG_FILE}" "${TRAEFIK_CONFIG_DIR}/tools-api.yml.next"

echo "远端导入镜像并启动 3 个后端、2 个前端容器"
remote_archive_backend="${DEPLOY_DIR}/$(basename "${BACKEND_ARCHIVE}")"
remote_archive_frontend="${DEPLOY_DIR}/$(basename "${FRONTEND_ARCHIVE}")"
run_ssh "set -e; cd '${DEPLOY_DIR}'; \
if command -v docker-compose >/dev/null 2>&1; then COMPOSE='docker-compose'; elif docker compose version >/dev/null 2>&1; then COMPOSE='docker compose'; else echo '未找到 docker compose 或 docker-compose' >&2; exit 1; fi; \
gzip -dc '${remote_archive_backend}' | docker load; \
gzip -dc '${remote_archive_frontend}' | docker load; \
docker network inspect traefik-gateway-v1 >/dev/null 2>&1 || docker network create traefik-gateway-v1 >/dev/null; \
docker network connect traefik-gateway-v1 spring-boot-admin-server 2>/dev/null || true; \
export TOOLS_API_IMAGE='${BACKEND_IMAGE}'; export TOOLS_API_WEB_IMAGE='${FRONTEND_IMAGE}'; \
export OLD_TOOLS_API_IMAGES=\"\$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk -v backend='${BACKEND_IMAGE}' -v frontend='${FRONTEND_IMAGE}' '\$1 ~ /^(tools-api-package|tools-api-web-package):/ && \$1 != backend && \$1 != frontend {print \$2}' | sort -u)\"; \
\${COMPOSE} -f DockerFile-gateway.yml.next config --quiet; \
docker rm -f traefik-middleware-multiple-1 traefik-middleware-multiple-2 traefik-middleware-multiple-3 traefik-middleware-web-multiple-1 traefik-middleware-web-multiple-2 2>/dev/null || true; \
if [ -f DockerFile-gateway.yml ]; then cp DockerFile-gateway.yml DockerFile-gateway.yml.bak; fi; \
mv DockerFile-gateway.yml.next DockerFile-gateway.yml; \
if [ -f '${TRAEFIK_CONFIG_DIR}/tools-api.yml' ]; then cp '${TRAEFIK_CONFIG_DIR}/tools-api.yml' '${TRAEFIK_CONFIG_DIR}/tools-api.yml.bak'; fi; \
mv '${TRAEFIK_CONFIG_DIR}/tools-api.yml.next' '${TRAEFIK_CONFIG_DIR}/tools-api.yml'; \
\${COMPOSE} -f DockerFile-gateway.yml up -d --pull never; \
for container in traefik-middleware-multiple-1 traefik-middleware-multiple-2 traefik-middleware-multiple-3 traefik-middleware-web-multiple-1 traefik-middleware-web-multiple-2; do \
  for attempt in \$(seq 1 40); do [ \"\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\${container}\" 2>/dev/null || true)\" = healthy ] && break; sleep 3; done; \
  [ \"\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\${container}\")\" = healthy ] || { echo \"容器未健康: \${container}\" >&2; exit 1; }; \
done; \
if [ -n \"\${OLD_TOOLS_API_IMAGES}\" ]; then \
  for old_image in \${OLD_TOOLS_API_IMAGES}; do \
    old_containers=\"\$(docker ps -aq --filter ancestor=\"\${old_image}\" 2>/dev/null || true)\"; \
    [ -z \"\${old_containers}\" ] || docker rm -f \${old_containers} >/dev/null 2>&1 || true; \
  done; \
  docker image rm \${OLD_TOOLS_API_IMAGES} >/dev/null 2>&1 || true; \
fi; \
docker image prune -f >/dev/null; \
rm -f '${remote_archive_backend}' '${remote_archive_frontend}' source-build-*.tar.gz"

echo "上线完成：后端 3 个容器，前端 2 个容器"
