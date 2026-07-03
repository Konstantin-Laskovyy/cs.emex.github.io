#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${AI_PROJECT_DIR:-/opt/emex-ai-assistant}"

echo "==> Установка локального AI-контура EMEX"
echo "==> Рабочая директория: ${PROJECT_DIR}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите скрипт через sudo: sudo bash scripts/install.sh"
  exit 1
fi

mkdir -p "${PROJECT_DIR}/"{scripts,nginx,data/ollama,data/anythingllm,data/open-webui,data/documents,data/backups}

echo "==> Проверяем Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Устанавливаем Docker Engine и Compose plugin..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "Docker найден: $(docker --version)"
fi

echo "==> Проверяем Docker Compose plugin"
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin не найден. Устанавливаем пакет docker-compose-plugin..."
  apt-get update
  apt-get install -y docker-compose-plugin
fi
docker compose version

echo "==> Проверяем файлы проекта"
for required_file in docker-compose.yml .env nginx/default.conf scripts/pull-models.sh scripts/backup.sh; do
  if [[ ! -f "${PROJECT_DIR}/${required_file}" ]]; then
    echo "Не найден файл ${PROJECT_DIR}/${required_file}"
    echo "Скопируйте весь каталог emex-ai-assistant в ${PROJECT_DIR} и повторите запуск."
    exit 1
  fi
done

echo "==> Выставляем права на скрипты"
chmod +x "${PROJECT_DIR}/scripts/"*.sh

echo "==> Запускаем сервисы"
cd "${PROJECT_DIR}"
docker compose pull
docker compose up -d

echo
echo "Готово."
echo "Open WebUI:    http://$(hostname -I | awk '{print $1}')/ai/webui/"
echo "AnythingLLM:   http://$(hostname -I | awk '{print $1}')/ai/anythingllm/"
echo "Ollama local:  http://127.0.0.1:11434"
echo
echo "Следующий шаг: загрузить модели"
echo "cd ${PROJECT_DIR} && sudo bash scripts/pull-models.sh"
