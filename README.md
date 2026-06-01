# FeedFlow

智能信息流摘要工具。订阅 Hacker News、Product Hunt、GitHub Trending、Dev.to 等数据源，由 n8n 定时抓取，Claude/DeepSeek AI 自动生成中文摘要，结果推送回后端存储。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | NestJS 11 + TypeScript + TypeORM |
| 数据库 | PostgreSQL 16 |
| Workflow 引擎 | n8n（本地 npx 运行） |
| AI | Claude API / DeepSeek API |
| 包管理 | pnpm workspace（monorepo） |

## 支持的数据源

| ID | 名称 | API | 需要 Token |
|----|------|-----|-----------|
| `hacker_news` | Hacker News | Firebase REST API | 否 |
| `product_hunt` | Product Hunt | GraphQL API | 是 |
| `github_trending` | GitHub Trending | 非官方 API | 否 |
| `devto` | Dev.to | 官方 REST API | 否 |

## 功能

### 订阅管理（首页）
- 从 4 个数据源中选择订阅
- 选择推送频率：每天（08:00）或每周（周一 08:00）
- 查看已订阅列表，支持启用/停用、删除
- 点击订阅卡片查看该数据源的历史摘要

### 摘要历史
- 按数据源 Tab 过滤摘要记录
- 点击摘要卡片展开 AI 生成的中文摘要详情

### 自动化流程（后台）
- 创建订阅时，NestJS 自动在 n8n 中创建对应工作流
- n8n 按 cron 定时抓取数据源 Top 10 内容
- 调用 AI API 生成中文摘要
- 通过 Webhook 回调 NestJS，存入 PostgreSQL

## 项目结构

```
FeedFlow/
├── apps/
│   ├── backend/          # NestJS 后端（端口 3000）
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── subscriptions/  # 订阅 CRUD
│   │       │   ├── digests/        # 摘要管理
│   │       │   ├── n8n/            # n8n API 封装
│   │       │   ├── webhook/        # 接收 n8n 回调
│   │       │   └── health/         # 健康检查
│   │       ├── config/             # 环境变量
│   │       └── database/           # 迁移文件
│   └── frontend/         # React 前端（端口 5173）
│       └── src/
│           ├── api/                # HTTP 请求层
│           ├── hooks/              # React Query hooks
│           ├── components/         # UI 组件
│           ├── pages/              # 页面（Home / DigestHistory）
│           ├── types/              # TypeScript 类型
│           └── lib/                # 工具函数、常量
├── packages/
│   └── shared/           # 共享类型定义
├── docs/                 # 详细设计文档
├── .env.example          # 环境变量模板
└── pnpm-workspace.yaml   # Monorepo 配置
```

## 本地启动

### 前置要求

| 工具 | 版本 | 安装 |
|------|------|------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| pnpm | >= 8 | `npm install -g pnpm` |
| PostgreSQL | 16 | `brew install postgresql@16` |
| n8n | 最新 | `npm install -g n8n`（需 Node 22） |

### 1. 安装依赖

```bash
git clone <repo-url>
cd FeedFlow
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入必填项：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=feedflow
DB_PASSWORD=feedflow_password
DB_DATABASE=feedflow_db

N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=          # 从 n8n 界面获取
N8N_WEBHOOK_SECRET=feedflow_secret_2024

CLAUDE_API_KEY=sk-ant-xxx    # 或使用 DeepSeek
```

### 3. 初始化数据库

```bash
# 启动 PostgreSQL
brew services start postgresql@16

# 首次创建数据库和用户
psql postgres -c "CREATE USER feedflow WITH PASSWORD 'feedflow_password';"
psql postgres -c "CREATE DATABASE feedflow_db OWNER feedflow;"

# 运行迁移
cd apps/backend && pnpm migration:run
```

### 4. 启动 n8n

n8n 需要 Node 22（Node 25 不兼容）：

```bash
nvm use 22
n8n start
```

首次启动后打开 http://localhost:5678 完成注册，然后：
**Settings → n8n API → Create an API key** → 填入 `.env` 的 `N8N_API_KEY`

### 5. 启动后端

```bash
# 回到项目根目录（切回 Node 25 或项目 Node 版本）
pnpm dev:backend
```

### 6. 启动前端

```bash
cd apps/frontend
pnpm dev
```

## 服务地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000/api/v1 |
| Swagger 文档 | http://localhost:3000/api/docs |
| n8n 工作流 | http://localhost:5678 |

## API 接口

```
GET    /api/v1/subscriptions?userId=xxx     # 获取订阅列表
POST   /api/v1/subscriptions                # 创建订阅
PUT    /api/v1/subscriptions/:id            # 更新订阅
DELETE /api/v1/subscriptions/:id            # 删除订阅

GET    /api/v1/digests/subscription/:id     # 获取订阅的摘要列表
GET    /api/v1/digests/:id                  # 获取摘要详情

GET    /api/v1/n8n/workflows                # 查看 n8n 工作流
GET    /api/v1/n8n/executions               # 查看执行记录
GET    /api/v1/health                       # 健康检查
```

## 数据库迁移

```bash
cd apps/backend
pnpm migration:run       # 执行迁移
pnpm migration:revert    # 回滚最后一次
pnpm migration:generate  # 根据 entity 变更生成新迁移
```

## 常见问题

**n8n 安装报错 `No module named 'distutils'`**

Python 3.12+ 移除了 `distutils`，需要用 Python 3.11 编译：

```bash
brew install python@3.11
npm install -g n8n --python=/usr/local/opt/python@3.11/bin/python3.11
```

**端口被占用**

```bash
lsof -ti:3000 | xargs kill   # 释放后端端口
lsof -ti:5173 | xargs kill   # 释放前端端口
```

**数据库连接失败**

```bash
brew services start postgresql@16
pg_isready
```

## 文档

- [系统架构](docs/architecture.md)
- [API 设计](docs/api.md)
- [n8n Workflow 设计](docs/n8n-workflows.md)
- [部署指南](docs/deployment.md)
- [本地搭建详细步骤](SETUP.md)
