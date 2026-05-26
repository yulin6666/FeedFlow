# API 设计

## 基础信息

| 环境 | Base URL |
|------|----------|
| 本地 | `http://localhost:3000/api/v1` |
| 生产 | `https://feedflow-backend.railway.app/api/v1` |

所有响应统一格式：
```json
{ "data": <payload> }           // 成功
{ "error": "message", "statusCode": 400 }  // 失败
```

---

## Sources（数据源元数据）

### GET /sources

返回支持的数据源白名单，前端用于渲染选项。

**Response 200**
```json
{
  "data": [
    { "id": "hacker_news",     "name": "Hacker News",     "description": "技术社区热帖" },
    { "id": "product_hunt",    "name": "Product Hunt",    "description": "每日新产品" },
    { "id": "github_trending", "name": "GitHub Trending", "description": "GitHub 热门仓库" },
    { "id": "devto",           "name": "Dev.to",          "description": "开发者文章" }
  ]
}
```

---

## Subscriptions（订阅管理）

### GET /subscriptions

获取用户的所有订阅。

**Query**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户 ID |

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "source": "hacker_news",
      "frequency": "daily",
      "isActive": true,
      "n8nWorkflowId": "wf_abc123",
      "createdAt": "2026-05-26T10:00:00Z",
      "latestDigest": {
        "id": "uuid",
        "generatedAt": "2026-05-26T08:00:00Z",
        "itemCount": 10
      }
    }
  ]
}
```

---

### POST /subscriptions

创建订阅，同时在 n8n 中创建对应 workflow。

**Request Body**
```json
{
  "userId": "uuid",
  "source": "hacker_news",
  "frequency": "daily"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户 ID |
| source | enum | 是 | `hacker_news` / `product_hunt` / `github_trending` / `devto` |
| frequency | enum | 是 | `daily` / `weekly` |

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "source": "hacker_news",
    "frequency": "daily",
    "isActive": true,
    "n8nWorkflowId": "wf_abc123",
    "createdAt": "2026-05-26T10:00:00Z"
  }
}
```

**Error Cases**
- `400` source 不在白名单
- `409` 该用户已订阅此数据源

---

### PATCH /subscriptions/:id

更新订阅频率，同步更新 n8n workflow 的 cron 表达式。

**Request Body**
```json
{
  "frequency": "weekly"
}
```

**Response 200**
```json
{
  "data": { "...updated subscription" }
}
```

---

### DELETE /subscriptions/:id

删除订阅，同步删除 n8n workflow。

**Response 204** No Content

---

### POST /subscriptions/:id/trigger

手动触发一次抓取（测试 / 演示用）。

**Response 202**
```json
{
  "message": "Workflow triggered",
  "executionId": "exec_xyz"
}
```

---

## Digests（摘要查询）

### GET /digests

分页查询摘要列表。

**Query**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户 ID |
| source | string | 否 | 按数据源过滤 |
| page | number | 否 | 默认 1 |
| limit | number | 否 | 默认 10，最大 50 |

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "source": "hacker_news",
      "summary": "本日 Hacker News 热点：AI 工具持续爆发...",
      "itemCount": 10,
      "generatedAt": "2026-05-26T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### GET /digests/:id

获取单条摘要详情，包含所有条目。

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "source": "hacker_news",
    "summary": "本日 Hacker News 热点概述...",
    "generatedAt": "2026-05-26T08:00:00Z",
    "items": [
      {
        "id": "uuid",
        "title": "Show HN: I built a...",
        "url": "https://example.com",
        "summary": "作者开发了一个用于...",
        "score": 342,
        "author": "user123",
        "tags": [],
        "position": 1
      }
    ]
  }
}
```

---

## Webhook（内部接口，n8n 回调）

### POST /webhook/digest

n8n 执行完成后回调此接口，存储摘要数据。

**Headers**
```
X-Webhook-Secret: <WEBHOOK_SECRET>
```

**Request Body**
```json
{
  "subscriptionId": "uuid",
  "source": "hacker_news",
  "executionId": "n8n_exec_id",
  "summary": "整体中文摘要...",
  "items": [
    {
      "title": "...",
      "url": "...",
      "summary": "单条摘要...",
      "score": 342,
      "author": "user123",
      "tags": [],
      "position": 1
    }
  ],
  "rawData": {}
}
```

**Response 201**
```json
{
  "digestId": "uuid",
  "message": "Digest saved"
}
```

**Error Cases**
- `401` X-Webhook-Secret 不匹配

---

## Health

### GET /health

健康检查，检测数据库和 n8n 连通性。

**Response 200**
```json
{
  "status": "ok",
  "database": "connected",
  "n8n": "reachable",
  "timestamp": "2026-05-26T10:00:00Z"
}
```
