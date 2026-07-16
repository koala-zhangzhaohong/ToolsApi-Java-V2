#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application.properties"
APP_DOCKER_PROPERTIES="${ROOT_DIR}/tools-web/src/main/resources/application-docker.properties"
GATEWAY_FILE="${ROOT_DIR}/DockerFile-gateway.yml"
DOCKERFILE="${ROOT_DIR}/ServerDockerFile"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_DOCKER_PROPERTIES}" | tr -d '[:space:]')"
if [[ -z "${VERSION_BASE}" ]]; then
  VERSION_BASE="$(awk -F= '/^spring\.application\.version\.base=/{print $2; exit}' "${APP_PROPERTIES}" | tr -d '[:space:]')"
fi
if [[ -z "${VERSION_BASE}" ]]; then
  echo "无法从 ${APP_DOCKER_PROPERTIES} 或 ${APP_PROPERTIES} 读取 spring.application.version.base" >&2
  exit 1
fi

if ! command -v mvn >/dev/null 2>&1; then
  echo "未找到 mvn，请先安装 Maven 或配置 PATH" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先安装 Docker 或配置 PATH" >&2
  exit 1
fi

BUILD_TIME="$(date '+%Y%m%d%H%M%S')"
IMAGE_NAME="tools-api-package:${VERSION_BASE}-docker"

echo "更新 Docker 配置 spring.application.build.time=${BUILD_TIME}"
if grep -q '^spring\.application\.build\.time=' "${APP_DOCKER_PROPERTIES}"; then
  perl -0pi -e "s/^spring\\.application\\.build\\.time=.*/spring.application.build.time=${BUILD_TIME}/m" "${APP_DOCKER_PROPERTIES}"
else
  printf '\nspring.application.build.time=%s\n' "${BUILD_TIME}" >> "${APP_DOCKER_PROPERTIES}"
fi

echo "移除主配置中的 spring.application.build.time"
perl -0pi -e "s/^# suppress inspection \"SpringBootApplicationProperties\"\\Rspring\\.application\\.build\\.time=.*\\R//m; s/^spring\\.application\\.build\\.time=.*\\R//m" "${APP_PROPERTIES}"

echo "切换 Spring profile 为 docker"
perl -0pi -e "s/^spring\\.profiles\\.active=.*/spring.profiles.active=docker/m" "${APP_PROPERTIES}"

echo "执行 Maven 打包"
(cd "${ROOT_DIR}" && mvn -Pdocker -DskipTests clean package)

echo "构建 Docker 镜像 ${IMAGE_NAME} (${DOCKER_PLATFORM})"
(cd "${ROOT_DIR}" && docker build --platform "${DOCKER_PLATFORM}" -f "${DOCKERFILE}" -t "${IMAGE_NAME}" .)

IMAGE_PLATFORM="$(docker image inspect "${IMAGE_NAME}" --format '{{.Os}}/{{.Architecture}}')"
if [[ "${IMAGE_PLATFORM}" != "${DOCKER_PLATFORM}" ]]; then
  echo "镜像架构不匹配: ${IMAGE_PLATFORM}, 期望: ${DOCKER_PLATFORM}" >&2
  exit 1
fi

echo "更新 ${GATEWAY_FILE} 中的 tools-api-package 镜像版本"
perl -0pi -e "s#tools-api-package:[^\\s\"']+-docker#${IMAGE_NAME}#g" "${GATEWAY_FILE}"

echo "打包完成: ${IMAGE_NAME}"
