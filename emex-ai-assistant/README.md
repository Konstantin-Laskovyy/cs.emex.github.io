# EMEX AI Assistant

Локальный self-hosted AI-контур для внутренней корпоративной социальной сети.

Состав:

- Ollama - локальный runtime для LLM и embeddings.
- Open WebUI - чат-интерфейс для сотрудников и администраторов.
- AnythingLLM - база знаний/RAG по внутренним документам.
- Nginx - reverse proxy внутри корпоративной сети.

Контур не использует платные внешние API OpenAI, Anthropic и других облачных провайдеров.

## 1. Структура проекта

Целевая директория на сервере:

```bash
/opt/emex-ai-assistant/
├── docker-compose.yml
├── .env
├── README.md
├── scripts/
│   ├── install.sh
│   ├── pull-models.sh
│   └── backup.sh
├── nginx/
│   └── default.conf
└── data/
    ├── ollama/
    ├── anythingllm/
    ├── open-webui/
    ├── documents/
    └── backups/
```

## 2. Первичная установка

Скопируйте папку `emex-ai-assistant` на Ubuntu-сервер:

```bash
sudo mkdir -p /opt/emex-ai-assistant
sudo cp -a emex-ai-assistant/. /opt/emex-ai-assistant/
cd /opt/emex-ai-assistant
```

Перед запуском смените секрет Open WebUI:

```bash
openssl rand -hex 32
sudo nano .env
```

Укажите значение в:

```env
OPENWEBUI_SECRET_KEY=...
```

Запуск установки:

```bash
cd /opt/emex-ai-assistant
sudo bash scripts/install.sh
```

Скрипт:

- создаст директории;
- установит Docker, если его нет;
- установит Docker Compose plugin, если его нет;
- скачает Docker-образы;
- запустит контейнеры.

## 3. Запуск и остановка

Запустить:

```bash
cd /opt/emex-ai-assistant
sudo docker compose up -d
```

Остановить:

```bash
cd /opt/emex-ai-assistant
sudo docker compose down
```

Перезапустить:

```bash
cd /opt/emex-ai-assistant
sudo docker compose restart
```

Проверить состояние:

```bash
cd /opt/emex-ai-assistant
sudo docker compose ps
```

Посмотреть логи:

```bash
cd /opt/emex-ai-assistant
sudo docker compose logs -f ollama
sudo docker compose logs -f open-webui
sudo docker compose logs -f anythingllm
sudo docker compose logs -f nginx
```

## 4. Загрузка моделей

После первого запуска загрузите модели:

```bash
cd /opt/emex-ai-assistant
sudo bash scripts/pull-models.sh
```

По умолчанию загружаются:

- `qwen2.5:7b-instruct` - основная instruct-модель;
- `llama3.2` - резервная чат-модель;
- `nomic-embed-text` - embeddings для RAG.

Команды внутри скрипта имеют вид:

```bash
docker exec -it emex-ollama ollama pull qwen2.5:7b-instruct
docker exec -it emex-ollama ollama pull llama3.2
docker exec -it emex-ollama ollama pull nomic-embed-text
```

Проверить список моделей:

```bash
sudo docker exec -it emex-ollama ollama list
```

## 5. Интерфейсы

Через Nginx на сервере `192.168.1.77`.

Важно: на этом сервере порт `80` уже используется корпоративной социальной сетью, поэтому AI-контур опубликован на отдельном порту `8088`.

- Open WebUI: `http://192.168.1.77:8088/`
- AnythingLLM: `http://192.168.1.77:8089/`

Локально на сервере для диагностики:

- Ollama: `http://127.0.0.1:11434`
- Open WebUI: `http://127.0.0.1:3000`
- AnythingLLM: `http://127.0.0.1:3001`

Если DNS `ai.emex.local` еще не настроен, открывайте по IP сервера:

```text
http://192.168.1.77:8088/
http://192.168.1.77:8089/
```

## 6. Подключение Open WebUI к Ollama

В `docker-compose.yml` уже задано:

```env
OLLAMA_BASE_URL=http://ollama:11434
```

В Open WebUI проверьте:

```text
Admin Panel -> Settings -> Connections -> Ollama
URL: http://ollama:11434
```

После загрузки моделей они должны появиться в списке моделей Open WebUI.

## 7. Подключение AnythingLLM к Ollama

В `docker-compose.yml` уже заданы переменные:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_PATH=http://ollama:11434
OLLAMA_MODEL_PREF=qwen2.5:7b-instruct
EMBEDDING_ENGINE=ollama
EMBEDDING_BASE_PATH=http://ollama:11434
EMBEDDING_MODEL_PREF=nomic-embed-text
```

В интерфейсе AnythingLLM проверьте:

```text
Settings -> LLM Preference -> Ollama
Base URL: http://ollama:11434
Chat model: qwen2.5:7b-instruct

Settings -> Embedder Preference -> Ollama
Base URL: http://ollama:11434
Embedding model: nomic-embed-text
```

## 8. Загрузка документов в базу знаний

Через AnythingLLM:

1. Откройте `http://ai.emex.local/ai/anythingllm/`.
2. Создайте Workspace, например `EMEX Knowledge Base`.
3. Перейдите в Documents.
4. Загрузите PDF, DOCX, TXT, CSV, XLSX или другие внутренние материалы.
5. Добавьте документы в Workspace.
6. Задайте вопрос в чате Workspace.

Рекомендуемый порядок документов:

- регламенты;
- инструкции;
- внутренние документы отделов;
- FAQ;
- документы ServiceDesk;
- HR-инструкции;
- IT-инструкции.

## 9. Резервное копирование

Создать backup:

```bash
cd /opt/emex-ai-assistant
sudo bash scripts/backup.sh
```

Архив будет создан в:

```bash
/opt/emex-ai-assistant/data/backups/
```

В backup попадают:

- `.env`;
- `docker-compose.yml`;
- `nginx/`;
- `scripts/`;
- `data/ollama`;
- `data/anythingllm`;
- `data/open-webui`;
- `data/documents`.

## 10. Восстановление

Пример:

```bash
cd /opt/emex-ai-assistant
sudo docker compose down
sudo tar -xzf /opt/emex-ai-assistant/data/backups/emex-ai-assistant-YYYYMMDD-HHMMSS.tar.gz -C /opt/emex-ai-assistant
sudo docker compose up -d
```

## 11. Обновление

Обновить Docker-образы:

```bash
cd /opt/emex-ai-assistant
sudo docker compose pull
sudo docker compose up -d
```

Перед обновлением рекомендуется сделать backup:

```bash
sudo bash scripts/backup.sh
```

## 12. Порты

| Сервис | Порт хоста | Порт контейнера | Доступ |
|---|---:|---:|---|
| Nginx/Open WebUI | 8088 | 80 | корпоративная сеть |
| Nginx/AnythingLLM | 8089 | 8089 | корпоративная сеть |
| Ollama | 127.0.0.1:11434 | 11434 | только сервер |
| Open WebUI | 127.0.0.1:3000 | 8080 | только сервер, наружу через Nginx |
| AnythingLLM | 127.0.0.1:3001 | 3001 | только сервер, наружу через Nginx |

## 13. Безопасность

Обязательно:

- не открывать порты `11434`, `3000`, `3001` в интернет;
- доступ к `80` давать только из корпоративной сети или VPN;
- не давать сотрудникам прямой доступ к Ollama;
- использовать Nginx как единую точку входа;
- в будущем добавить LDAP/AD-авторизацию;
- логировать вопросы пользователей;
- не передавать персональные данные во внешние API;
- регулярно делать backup.

Пример UFW:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 80 proto tcp
sudo ufw allow from 192.168.0.0/16 to any port 8088 proto tcp
sudo ufw allow from 192.168.0.0/16 to any port 8089 proto tcp
sudo ufw deny 11434/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 3001/tcp
sudo ufw enable
sudo ufw status
```

## 14. План интеграции с корпоративной социальной сетью

Цель: добавить AI-слой в текущий backend соцсети, чтобы сотрудники могли искать людей, отделы, документы и получать ответы с учетом прав доступа.

### API-слой

#### `POST /api/ai/search`

Назначение: поиск сотрудников, отделов, документов.

Пример запроса:

```json
{
  "user_id": 15,
  "query": "ServiceDesk",
  "types": ["users", "departments", "documents"]
}
```

Ответ:

```json
{
  "items": [
    {
      "type": "department",
      "id": 7,
      "title": "IT-отдел",
      "url": "/departments/7"
    }
  ]
}
```

#### `POST /api/ai/ask`

Назначение: вопрос ассистенту с учетом прав пользователя.

Пример:

```json
{
  "user_id": 15,
  "query": "Кто отвечает за ServiceDesk?",
  "context": {
    "department": "IT",
    "roles": ["employee"]
  }
}
```

Ответ:

```json
{
  "answer": "За ServiceDesk отвечает IT-отдел. Основной контакт: ...",
  "sources": [
    {
      "title": "Регламент ServiceDesk",
      "url": "/uploads/departments/3/servicedesk.pdf"
    }
  ]
}
```

#### `POST /api/ai/index`

Назначение: переиндексация сотрудников, отделов и документов.

Доступ: только admin или системная задача.

#### `POST /api/ai/document/upload`

Назначение: загрузка документа в базу знаний соцсети и AI-индекс.

Доступ: admin, HR, руководитель отдела или владелец документа.

### Metadata для индекса

Каждый документ в индексе должен хранить metadata:

```json
{
  "document_id": 123,
  "title": "Регламент ServiceDesk",
  "department_id": 3,
  "allowed_roles": ["admin", "it"],
  "allowed_users": [15, 22],
  "access_level": "department",
  "source_url": "/uploads/departments/3/servicedesk.pdf",
  "updated_at": "2026-07-03T10:00:00Z"
}
```

### ACL

Перед выдачей результата нужно проверять:

- роль пользователя;
- отдел пользователя;
- является ли пользователь руководителем отдела;
- есть ли пользователь в `allowed_users`;
- разрешен ли его `role` в `allowed_roles`;
- не является ли документ закрытым для другого отдела.

AI не должен видеть и цитировать документы, к которым у пользователя нет доступа.

### RAG-схема

```text
Вопрос пользователя
-> определение типа запроса
-> поиск по сотрудникам / отделам / документам
-> проверка ACL
-> передача разрешенного контекста в LLM через Ollama
-> ответ пользователю со ссылками на источники
```

### Рекомендуемая backend-архитектура

```text
app/api/ai.py
app/services/ai/search.py
app/services/ai/indexer.py
app/services/ai/acl.py
app/services/ai/ollama_client.py
app/models/ai_document.py
app/models/ai_document_chunk.py
```

На первом этапе можно не внедрять отдельную vector DB, а использовать AnythingLLM для базы знаний. На втором этапе лучше добавить собственный индекс в backend соцсети, чтобы ACL был полностью под контролем приложения.

## 15. Команды проверки

```bash
cd /opt/emex-ai-assistant
sudo docker compose ps
curl -I http://127.0.0.1:11434
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3001
curl -I http://127.0.0.1:8088/
curl -I http://127.0.0.1:8089/
sudo docker exec -it emex-ollama ollama list
```

## 17. Если Docker Compose пишет, что переменные не заданы

Если видите предупреждения вида:

```text
The "OLLAMA_BASE_URL" variable is not set. Defaulting to a blank string.
The "OPENWEBUI_SECRET_KEY" variable is not set. Defaulting to a blank string.
```

значит `docker compose` запущен не из директории `/opt/emex-ai-assistant` или не получил `.env`.

Правильно:

```bash
cd /opt/emex-ai-assistant
sudo docker compose --env-file .env up -d
```

Также можно проверить, что compose видит переменные:

```bash
cd /opt/emex-ai-assistant
sudo docker compose --env-file .env config
```

## 16. Важное замечание про reverse proxy

Open WebUI и AnythingLLM лучше всего работают на корневом пути домена. В этом комплекте настроены маршруты:

- `/ai/webui/`
- `/ai/anythingllm/`

Если какой-то интерфейс после обновления начнет некорректно отдавать статические файлы через подкаталог, самый надежный вариант:

- `webui.ai.emex.local` -> Open WebUI;
- `anythingllm.ai.emex.local` -> AnythingLLM.

Но для простого запуска внутри сети текущая схема через `/ai/...` уже подготовлена.
