#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${AI_PROJECT_DIR:-/opt/emex-ai-assistant}"
BACKUP_DIR="${PROJECT_DIR}/data/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/emex-ai-assistant-${STAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"
cd "${PROJECT_DIR}"

echo "==> Создаем резервную копию данных AI-контура"
tar \
  --exclude="./data/backups" \
  -czf "${ARCHIVE}" \
  .env docker-compose.yml nginx scripts data

echo "Резервная копия создана:"
echo "${ARCHIVE}"
echo
echo "Восстановление:"
echo "cd ${PROJECT_DIR}"
echo "sudo docker compose down"
echo "sudo tar -xzf ${ARCHIVE} -C ${PROJECT_DIR}"
echo "sudo docker compose up -d"
