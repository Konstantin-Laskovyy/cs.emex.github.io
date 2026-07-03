#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${AI_PROJECT_DIR:-/opt/emex-ai-assistant}"
cd "${PROJECT_DIR}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PRIMARY_CHAT_MODEL="${PRIMARY_CHAT_MODEL:-qwen2.5:7b-instruct}"
FALLBACK_CHAT_MODEL="${FALLBACK_CHAT_MODEL:-llama3.2}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-nomic-embed-text}"

echo "==> Проверяем контейнер emex-ollama"
docker compose up -d ollama

echo "==> Загружаем основную модель: ${PRIMARY_CHAT_MODEL}"
docker exec -it emex-ollama ollama pull "${PRIMARY_CHAT_MODEL}"

echo "==> Загружаем резервную модель: ${FALLBACK_CHAT_MODEL}"
docker exec -it emex-ollama ollama pull "${FALLBACK_CHAT_MODEL}"

echo "==> Загружаем embedding-модель: ${EMBEDDING_MODEL}"
docker exec -it emex-ollama ollama pull "${EMBEDDING_MODEL}"

echo "==> Список моделей"
docker exec -it emex-ollama ollama list
