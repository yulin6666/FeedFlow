# 系统架构

## 整体架构

```
用户浏览器 (React)
      │
      │ HTTP / REST API
      ▼
NestJS 后端 (Port 3000)
      │                    │
      │ n8n REST API        │ PostgreSQL
      ▼                    ▼
n8n (Port 5678)       feedflow DB
      │
      │ 定时触发
      ▼
外部数据源 API
(HN / PH / GitHub / Dev.to)
      │
      │ 原始数据
      ▼
Claude API
(生成中文摘要)
      │
      │ Webhook 回调
      ▼
NestJS /webhook/digest
      │
      ▼
存入 PostgreSQL
```

## 核心流程

### 1. 用户创建订阅

```
前端选择数据源 + 频率
      ↓
POST /api/v1/subscriptions
      ↓
NestJS 校验（source 白名单、user+source 唯一性）
      ↓
N8nService.createWorkflow()
  ├─ 加载对应 source 的 workflow 模板 JSON
  ├─ 替换模板变量（subscriptionId, cron, secrets）
  ├─ POST n8n /api/v1/workflows → 获取 workflowId
  └─ PATCH n8n /api/v1/workflows/:id { active: true }
      ↓
保存 subscription 记录（含 n8nWorkflowId）
      ↓
返回 201 给前端
```

### 2. n8n 定时执行

```
Schedule Trigger（cron）
      ↓
抓取数据源 Top 10
      ↓
调用 Claude API 生成摘要
      ↓
POST NestJS /api/v1/webhook/digest
  （携带 X-Webhook-Secret 验证）
      ↓
NestJS 存入 digests + digest_items 表
```

### 3. 用户查看摘要

```
前端 Dashboard
      ↓
GET /api/v1/digests?userId=xxx
      ↓
NestJS 查询 PostgreSQL
      ↓
返回摘要列表 + 分页
```

## 模块划分

### NestJS 后端模块

```
src/
├── modules/
│   ├── subscriptions/    # 订阅 CRUD + 调 n8n API
│   ├── digests/          # 摘要查询
│   ├── n8n/              # n8n REST API 封装
│   └── webhook/          # 接收 n8n 回调
├── config/               # 环境变量配置
└── database/             # TypeORM 迁移
```

### React 前端页面

```
src/
├── pages/
│   ├── Home.tsx           # 订阅管理 + 数据源选择
│   └── DigestHistory.tsx  # 摘要历史列表
├── components/
│   ├── SourceSelector.tsx # 数据源选择卡片
│   ├── FrequencyPicker.tsx
│   └── DigestCard.tsx     # 摘要展示卡片
└── hooks/
    ├── useSubscriptions.ts
    └── useDigests.ts
```

## 数据库 Schema

```sql
-- 用户（简化，支持匿名）
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 订阅（用户订阅了哪些数据源）
CREATE TABLE subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source           VARCHAR(50) NOT NULL,
  -- 枚举: hacker_news | product_hunt | github_trending | devto
  frequency        VARCHAR(10) NOT NULL,
  -- 枚举: daily | weekly
  n8n_workflow_id  VARCHAR(255),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source)
);

-- 摘要（每次 n8n 执行生成一条）
CREATE TABLE digests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  source            VARCHAR(50) NOT NULL,
  summary           TEXT NOT NULL,       -- Claude 生成的整体概述
  raw_data          JSONB,               -- n8n 抓取的原始数据
  item_count        INTEGER NOT NULL DEFAULT 0,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  n8n_execution_id  VARCHAR(255)
);

-- 摘要条目（每条具体内容）
CREATE TABLE digest_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id  UUID NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  title      VARCHAR(500) NOT NULL,
  url        TEXT NOT NULL,
  summary    TEXT,           -- 单条 Claude 摘要
  score      INTEGER,        -- HN points / PH votes / GitHub stars
  author     VARCHAR(255),
  tags       TEXT[],
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 实体关系

```
User (1) ──── (N) Subscription (1) ──── (N) Digest (1) ──── (N) DigestItem
```

## 关键设计决策

**数据源白名单**：source 字段只接受 4 个固定值，后端枚举校验，前端下拉选择，不允许用户输入 URL。

**每个订阅对应一个 n8n workflow**：创建订阅时动态创建 workflow，删除订阅时同步删除 workflow，workflow ID 存在 subscriptions 表。

**Webhook 安全**：n8n 回调 NestJS 时携带 `X-Webhook-Secret` header，NestJS 校验后才处理数据。

**n8n 与 NestJS 通信**：
- NestJS → n8n：通过 n8n REST API（`X-N8N-API-KEY` 认证）
- n8n → NestJS：通过 HTTP Request 节点 + Webhook Secret
