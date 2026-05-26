# FeedFlow 本地后端搭建指南

## 前置要求

| 工具 | 版本要求 | 安装方式 |
|------|---------|---------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| pnpm | >= 8 | `npm install -g pnpm` |
| Homebrew | 最新版 | [brew.sh](https://brew.sh) |
| PostgreSQL | 16 | `brew install postgresql@16` |

## 快速启动

### 1. 安装并启动 PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
```

创建数据库和用户：

```bash
psql postgres -c "CREATE USER feedflow WITH PASSWORD 'feedflow_password';"
psql postgres -c "CREATE DATABASE feedflow_db OWNER feedflow;"
```

### 2. 克隆并安装依赖

```bash
git clone <repo-url>
cd FeedFlow
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 默认配置已可直接使用，无需修改
```

### 4. 运行数据库迁移

```bash
cd apps/backend
pnpm migration:run
```

### 5. 启动 NestJS 后端

```bash
# 在根目录
pnpm dev:backend
```

后端将在 `http://localhost:3000` 启动。

### 6. 启动 n8n（可选）

```bash
npx n8n
```

n8n 将在 `http://localhost:5678` 启动。由于 n8n 和 NestJS 都在本机，回调地址直接用 `localhost:3000`。

## 服务地址

| 服务 | 地址 |
|------|------|
| NestJS API | http://localhost:3000/api/v1 |
| Swagger 文档 | http://localhost:3000/api/docs |
| n8n 工作流 | http://localhost:5678 |
| PostgreSQL | localhost:5432 |

## API 端点

### 订阅管理

```
GET    /api/v1/subscriptions          # 列出所有订阅（?userId=xxx 过滤）
GET    /api/v1/subscriptions/:id      # 获取单个订阅
POST   /api/v1/subscriptions          # 创建订阅
PUT    /api/v1/subscriptions/:id      # 更新订阅
DELETE /api/v1/subscriptions/:id      # 删除订阅
```

### 摘要管理

```
GET    /api/v1/digests/subscription/:subscriptionId  # 列出订阅的摘要
GET    /api/v1/digests/:id                           # 获取单个摘要
POST   /api/v1/digests/subscription/:subscriptionId  # 触发新摘要
```

### n8n 集成

```
GET    /api/v1/n8n/workflows          # 列出 n8n 工作流
GET    /api/v1/n8n/executions         # 列出执行记录
GET    /api/v1/n8n/executions/:id     # 获取执行详情
```

### Webhook（n8n 回调）

```
POST   /api/v1/webhook/n8n/digest-complete  # n8n 处理完成后回调
```

请求头需要携带 `X-Webhook-Secret`，对应 `.env` 中的 `N8N_WEBHOOK_SECRET`。

### 健康检查

```
GET    /api/v1/health                 # 服务健康状态
```

## n8n 配置说明

n8n 和 NestJS 都跑在本机，回调地址直接用 `localhost`：

```
http://localhost:3000/api/v1/webhook/n8n/digest-complete
```

### 获取 n8n API Key

1. 访问 http://localhost:5678，完成初始化设置
2. 进入 Settings → API → Create API Key
3. 将 API Key 填入 `.env` 的 `N8N_API_KEY`

## 数据库迁移命令

```bash
cd apps/backend

# 运行所有待执行迁移
pnpm migration:run

# 回滚最后一次迁移
pnpm migration:revert

# 生成新迁移（基于 entity 变更）
pnpm migration:generate src/database/migrations/MigrationName
```

## 停止服务

```bash
# 停止 PostgreSQL
brew services stop postgresql@16
```

## 项目结构

```
FeedFlow/
├── apps/
│   └── backend/               # NestJS 后端
│       └── src/
│           ├── config/        # 环境变量配置
│           ├── database/      # 数据库迁移、DataSource
│           └── modules/
│               ├── subscriptions/  # 订阅 CRUD
│               ├── digests/        # 摘要管理
│               ├── n8n/            # n8n API 封装
│               ├── webhook/        # n8n 回调接收
│               └── health/         # 健康检查
├── packages/
│   └── shared/                # 共享类型定义
├── .env.example               # 环境变量模板
└── pnpm-workspace.yaml        # Monorepo 配置
```
