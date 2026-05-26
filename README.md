# FeedFlow

订阅固定内容源，由 AI 自动生成中文摘要，在 Dashboard 集中阅读。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + TypeScript + Vite |
| 后端 | NestJS + TypeScript |
| 数据库 | PostgreSQL + TypeORM |
| Workflow 引擎 | n8n (self-host) |
| AI | Claude API (claude-sonnet-4-6) |
| 部署 | Docker Compose (本地) / Railway (生产) |

## 支持的数据源

| ID | 名称 | API |
|----|------|-----|
| `hacker_news` | Hacker News | Firebase REST API（免费，无需 token） |
| `product_hunt` | Product Hunt | GraphQL API（需要 token） |
| `github_trending` | GitHub Trending | 非官方 API（免费） |
| `devto` | Dev.to | REST API（免费，无需 token） |

## 项目结构

```
feedflow/
├── apps/
│   ├── frontend/          # React + Vite
│   └── backend/           # NestJS
├── packages/
│   └── shared/            # 共享 TypeScript 类型
├── docs/                  # 项目文档
├── docker-compose.yml     # 本地开发环境
├── .env.example
└── pnpm-workspace.yaml
```

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 复制环境变量
cp .env.example .env
# 填写 CLAUDE_API_KEY 等必填项

# 3. 启动本地环境
docker compose up -d

# 4. 运行数据库迁移
cd apps/backend && pnpm migration:run

# 5. 启动开发服务器
pnpm dev
```

访问：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api/v1
- n8n 管理界面：http://localhost:5678（admin / admin123）

## 文档

- [系统架构](docs/architecture.md)
- [API 设计](docs/api.md)
- [n8n Workflow 设计](docs/n8n-workflows.md)
- [部署指南](docs/deployment.md)
