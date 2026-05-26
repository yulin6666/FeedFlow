# 部署指南

## 本地开发

### 前置条件

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 步骤

**1. 克隆项目，安装依赖**
```bash
git clone <repo>
cd feedflow
pnpm install
```

**2. 配置环境变量**
```bash
cp .env.example .env
```

必填项：
```bash
CLAUDE_API_KEY=sk-ant-...          # Anthropic API Key
PRODUCT_HUNT_TOKEN=...             # Product Hunt Developer Token（可选，不订阅 PH 可不填）
```

**3. 启动基础服务**
```bash
docker compose up -d
# 启动 PostgreSQL + n8n
```

**4. 运行数据库迁移**
```bash
cd apps/backend
pnpm migration:run
```

**5. 启动开发服务器**
```bash
# 根目录
pnpm dev
# 同时启动 frontend (5173) 和 backend (3000)
```

**6. 配置 n8n API Key**

访问 http://localhost:5678，登录（admin / admin123），进入：
Settings → API → Create API Key → 复制到 `.env` 的 `N8N_API_KEY`

### 本地服务地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000/api/v1 |
| n8n 管理界面 | http://localhost:5678 |
| PostgreSQL | localhost:5432 |

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: feedflow
      POSTGRES_USER: feedflow
      POSTGRES_PASSWORD: feedflow_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U feedflow"]
      interval: 5s
      timeout: 5s
      retries: 5

  n8n:
    image: n8nio/n8n:latest
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin123
      - N8N_API_DISABLED=false
      - N8N_ENCRYPTION_KEY=local_dev_32char_encryption_key!
      - WEBHOOK_URL=http://localhost:5678
      - NESTJS_WEBHOOK_URL=http://host.docker.internal:3000
      - WEBHOOK_SECRET=local_dev_secret
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - PRODUCT_HUNT_TOKEN=${PRODUCT_HUNT_TOKEN}
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  n8n_data:
```

> 注意：n8n 回调 NestJS 时用 `host.docker.internal:3000`（Docker 访问宿主机），NestJS 本地直接跑不在容器里。

---

## Railway 部署

### Service 划分

Railway 项目下创建 4 个 Service：

```
feedflow (Railway Project)
├── feedflow-postgres   ← Railway PostgreSQL Plugin
├── feedflow-n8n        ← Docker Image: n8nio/n8n:latest
├── feedflow-backend    ← NestJS，Root: apps/backend
└── feedflow-frontend   ← React，Root: apps/frontend
```

### 部署顺序

1. 先创建 `feedflow-postgres`（PostgreSQL Plugin）
2. 部署 `feedflow-n8n`，等待启动后获取 API Key
3. 部署 `feedflow-backend`，填入 n8n API Key
4. 部署 `feedflow-frontend`，填入 backend URL

---

### feedflow-postgres

使用 Railway 内置 PostgreSQL Plugin，自动提供以下变量供其他 Service 引用：
- `${{feedflow-postgres.DATABASE_URL}}`
- `${{feedflow-postgres.PGHOST}}`
- `${{feedflow-postgres.PGPORT}}`
- `${{feedflow-postgres.PGUSER}}`
- `${{feedflow-postgres.PGPASSWORD}}`

---

### feedflow-n8n

**配置**
```
Docker Image: n8nio/n8n:latest
Port: 5678
Volume: /home/node/.n8n  (需要挂载 Persistent Volume)
```

**环境变量**
```bash
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<强密码>
N8N_API_DISABLED=false
N8N_ENCRYPTION_KEY=<openssl rand -hex 16>

# n8n 自身的 URL（用于 webhook 注册）
WEBHOOK_URL=https://feedflow-n8n.railway.app

# 回调 NestJS 的地址
NESTJS_WEBHOOK_URL=https://feedflow-backend.railway.app
WEBHOOK_SECRET=<openssl rand -hex 32>

# AI + 数据源
CLAUDE_API_KEY=sk-ant-...
PRODUCT_HUNT_TOKEN=<PH token>

# n8n 使用 PostgreSQL 存储执行数据
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${{feedflow-postgres.PGHOST}}
DB_POSTGRESDB_PORT=${{feedflow-postgres.PGPORT}}
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=${{feedflow-postgres.PGUSER}}
DB_POSTGRESDB_PASSWORD=${{feedflow-postgres.PGPASSWORD}}
```

**部署后操作**：访问 n8n 管理界面，Settings → API → Create API Key，复制到 backend 的 `N8N_API_KEY`。

---

### feedflow-backend

**配置**
```
Root Directory: apps/backend
Build Command:  pnpm install && pnpm build
Start Command:  node dist/main.js
Port:           3000
```

**环境变量**
```bash
NODE_ENV=production
DATABASE_URL=${{feedflow-postgres.DATABASE_URL}}

N8N_BASE_URL=https://feedflow-n8n.railway.app
N8N_API_KEY=<从 n8n 管理界面获取>

WEBHOOK_SECRET=<与 n8n 相同的值>
NESTJS_WEBHOOK_URL=https://feedflow-backend.railway.app

CLAUDE_API_KEY=sk-ant-...
```

---

### feedflow-frontend

**配置**
```
Root Directory: apps/frontend
Build Command:  pnpm install && pnpm build
Start Command:  npx serve dist -p $PORT
Port:           $PORT (Railway 自动分配)
```

**环境变量**
```bash
VITE_API_BASE_URL=https://feedflow-backend.railway.app/api/v1
```

---

## 环境变量完整清单

### .env.example（本地开发）

```bash
# ===== Backend =====
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://feedflow:feedflow_dev@localhost:5432/feedflow

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=                        # 从 n8n Settings > API 获取后填入

# Webhook 安全
WEBHOOK_SECRET=local_dev_secret
NESTJS_WEBHOOK_URL=http://localhost:3000

# AI
CLAUDE_API_KEY=sk-ant-...

# ===== 数据源 API Keys =====
PRODUCT_HUNT_TOKEN=                 # https://www.producthunt.com/v2/oauth/applications
# Hacker News、Dev.to、GitHub Trending 无需 token

# ===== Frontend =====
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

---

## 费用估算（Railway）

| Service | 资源消耗 | 月费估算 |
|---------|---------|---------|
| feedflow-postgres | 256MB RAM | ~$1 |
| feedflow-n8n | 256MB RAM，低 CPU | ~$1.5 |
| feedflow-backend | 256MB RAM，低 CPU | ~$1.5 |
| feedflow-frontend | 静态文件，极低 | ~$0.5 |
| **合计** | | **~$4.5/月** |

Railway Hobby Plan $5/月，包含 $5 credit，基本覆盖。
