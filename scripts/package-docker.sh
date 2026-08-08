#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application.properties"
APP_DOCKER_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application-docker.properties"
DOCKERFILE_BACKEND="${ROOT_DIR}/ServerDockerFile"
DOCKERFILE_FRONTEND="${ROOT_DIR}/Dockerfile.frontend"
GATEWAY_FILE="${ROOT_DIR}/DockerFile-gateway.yml"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_DOCKER_PROPERTIES}" | tr -d '[:space:]')"
IMAGE_VERSION="${IMAGE_VERSION:-${VERSION_BASE}-docker}"
BACKEND_IMAGE="tools-api-package:${IMAGE_VERSION}"
FRONTEND_IMAGE="tools-api-web-package:${IMAGE_VERSION}"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/image-output}"

[[ -n "${VERSION_BASE}" ]] || { echo "无法读取 application-docker.properties 中的版本号" >&2; exit 1; }
command -v mvn >/dev/null 2>&1 || { echo "未找到 mvn" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "未找到 docker" >&2; exit 1; }
command -v gzip >/dev/null 2>&1 || { echo "未找到 gzip" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon 未运行" >&2; exit 1; }

original_profile="$(grep -E '^spring\.profiles\.active=' "${APP_PROPERTIES}" || true)"
restore_profile() {
  if [[ -n "${original_profile}" ]]; then
    if grep -q '^spring\.profiles\.active=' "${APP_PROPERTIES}"; then
      perl -0pi -e "s/^spring\\.profiles\\.active=.*/${original_profile}/m" "${APP_PROPERTIES}"
    else
      printf '\n%s\n' "${original_profile}" >> "${APP_PROPERTIES}"
    fi
  fi
}
trap restore_profile EXIT

BUILD_TIME="$(date '+%Y%m%d%H%M%S')"
echo "更新 Docker 配置 spring.application.build.time=${BUILD_TIME}"
if grep -q '^spring\.application\.build\.time=' "${APP_DOCKER_PROPERTIES}"; then
  perl -0pi -e "s/^spring\\.application\\.build\\.time=.*/spring.application.build.time=${BUILD_TIME}/m" "${APP_DOCKER_PROPERTIES}"
else
  printf '\nspring.application.build.time=%s\n' "${BUILD_TIME}" >> "${APP_DOCKER_PROPERTIES}"
fi

echo "切换 Spring profile 为 docker（脚本结束后自动恢复）"
perl -0pi -e 's/^spring\.profiles\.active=.*/spring.profiles.active=docker/m' "${APP_PROPERTIES}"

echo "执行 Maven 打包（docker profile）"
(cd "${ROOT_DIR}" && mvn -Pdocker -DskipTests clean package)

echo "构建后端镜像 ${BACKEND_IMAGE}"
(cd "${ROOT_DIR}" && docker build --platform "${DOCKER_PLATFORM}" -f "${DOCKERFILE_BACKEND}" -t "${BACKEND_IMAGE}" .)

echo "构建前端镜像 ${FRONTEND_IMAGE}"
(cd "${ROOT_DIR}" && docker build --platform "${DOCKER_PLATFORM}" -f "${DOCKERFILE_FRONTEND}" -t "${FRONTEND_IMAGE}" .)

for image in "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}"; do
  image_platform="$(docker image inspect "${image}" --format '{{.Os}}/{{.Architecture}}')"
  [[ "${image_platform}" == "${DOCKER_PLATFORM}" ]] || {
    echo "镜像架构不匹配: ${image_platform}，期望 ${DOCKER_PLATFORM}" >&2
    exit 1
  }
done

mkdir -p "${OUTPUT_DIR}"
BACKEND_ARCHIVE="${OUTPUT_DIR}/${BACKEND_IMAGE//:/-}.tar.gz"
FRONTEND_ARCHIVE="${OUTPUT_DIR}/${FRONTEND_IMAGE//:/-}.tar.gz"
docker save "${BACKEND_IMAGE}" | gzip -1 > "${BACKEND_ARCHIVE}"
docker save "${FRONTEND_IMAGE}" | gzip -1 > "${FRONTEND_ARCHIVE}"

echo "校验 Compose 配置"
TOOLS_API_IMAGE="${BACKEND_IMAGE}" TOOLS_API_WEB_IMAGE="${FRONTEND_IMAGE}" docker compose -f "${GATEWAY_FILE}" config --quiet 2>/dev/null || \
  docker-compose -f "${GATEWAY_FILE}" config --quiet

echo "打包完成"
echo "  后端: ${BACKEND_IMAGE} -> ${BACKEND_ARCHIVE}"
echo "  前端: ${FRONTEND_IMAGE} -> ${FRONTEND_ARCHIVE}"
