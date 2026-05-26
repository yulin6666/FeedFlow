# n8n Workflow 设计

## 概述

每个 subscription 对应一个独立的 n8n workflow。NestJS 通过 n8n REST API 动态创建/删除 workflow。

所有 workflow 共用相同的节点结构：

```
[Schedule Trigger] → [Fetch Data] → [Transform] → [Claude Summarize] → [Webhook Callback]
```

---

## NestJS 调用 n8n API

### 认证

```
Base URL: http://n8n:5678/api/v1   (本地 Docker 内网)
         https://feedflow-n8n.railway.app/api/v1  (生产)
Header:  X-N8N-API-KEY: <N8N_API_KEY>
```

### 核心操作

| 操作 | 方法 | 路径 |
|------|------|------|
| 创建 workflow | POST | `/api/v1/workflows` |
| 激活 workflow | PATCH | `/api/v1/workflows/:id` body: `{ active: true }` |
| 更新 cron | PATCH | `/api/v1/workflows/:id` |
| 手动触发 | POST | `/api/v1/workflows/:id/run` |
| 删除 workflow | DELETE | `/api/v1/workflows/:id` |
| 查询执行历史 | GET | `/api/v1/executions?workflowId=:id` |

### N8nService 接口

```typescript
class N8nService {
  // 创建 workflow，返回 n8n workflow ID
  createWorkflow(subscriptionId: string, source: FeedSource, frequency: Frequency): Promise<string>

  // 更新 cron 表达式（用户改频率时调用）
  updateWorkflowSchedule(workflowId: string, frequency: Frequency): Promise<void>

  // 删除 workflow
  deleteWorkflow(workflowId: string): Promise<void>

  // 手动触发一次执行，返回 executionId
  triggerWorkflow(workflowId: string): Promise<string>

  // 健康检查
  ping(): Promise<boolean>
}
```

### 模板变量替换

NestJS 维护 4 个 workflow JSON 模板（每个数据源一个），创建时动态替换：

```typescript
const TEMPLATE_VARIABLES = {
  __SUBSCRIPTION_ID__:    subscription.id,
  __CRON_EXPRESSION__:    frequency === 'daily' ? '0 8 * * *' : '0 8 * * 1',
  __NESTJS_WEBHOOK_URL__: process.env.NESTJS_WEBHOOK_URL,
  __WEBHOOK_SECRET__:     process.env.WEBHOOK_SECRET,
  __CLAUDE_API_KEY__:     process.env.CLAUDE_API_KEY,
  __PRODUCT_HUNT_TOKEN__: process.env.PRODUCT_HUNT_TOKEN,  // 仅 PH 模板用
}
```

---

## Workflow 节点详细设计

### 通用节点（所有数据源共用）

**节点 1：Schedule Trigger**
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "parameters": {
    "rule": {
      "interval": [{ "field": "cronExpression", "expression": "__CRON_EXPRESSION__" }]
    }
  }
}
```

**节点 N-1：Claude API 调用**
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "headers": {
      "x-api-key": "__CLAUDE_API_KEY__",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    "body": {
      "model": "claude-sonnet-4-6",
      "max_tokens": 2000,
      "messages": [{
        "role": "user",
        "content": "以下是今日 {{source}} 热门内容，请用中文为每条生成一句话摘要，并给出整体趋势总结。\n返回严格 JSON 格式：{ \"summary\": \"整体摘要\", \"items\": [{\"title\": \"\", \"url\": \"\", \"summary\": \"\"}] }\n\n{{ JSON.stringify($json.items) }}"
      }]
    }
  }
}
```

**节点 N：Webhook 回调 NestJS**
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "__NESTJS_WEBHOOK_URL__/api/v1/webhook/digest",
    "headers": {
      "X-Webhook-Secret": "__WEBHOOK_SECRET__",
      "Content-Type": "application/json"
    },
    "body": {
      "subscriptionId": "__SUBSCRIPTION_ID__",
      "source": "{{source}}",
      "executionId": "={{ $execution.id }}",
      "summary": "={{ $json.summary }}",
      "items": "={{ $json.items }}"
    }
  }
}
```

---

### Hacker News Workflow

数据源：Firebase REST API（免费，无需 token）

```
[Schedule Trigger]
      ↓
[HTTP] GET https://hacker-news.firebaseio.com/v0/topstories.json
      → 返回 [id1, id2, ...500]
      ↓
[Code] slice(0, 10) → 生成 10 个 { id } 对象
      ↓
[Split In Batches] 每批 1 个
      ↓
[HTTP] GET https://hacker-news.firebaseio.com/v0/item/{{ $json.id }}.json
      → 返回单条 story { title, url, score, by, time }
      ↓
[Aggregate] 合并 10 条 story 为数组
      ↓
[Code] 格式化为标准 items 结构
      ↓
[HTTP] Claude API
      ↓
[Code] 解析 Claude JSON 响应
      ↓
[HTTP] Webhook 回调 NestJS
```

**格式化节点代码**
```javascript
const stories = $input.all().map((item, index) => ({
  title: item.json.title,
  url: item.json.url || `https://news.ycombinator.com/item?id=${item.json.id}`,
  score: item.json.score,
  author: item.json.by,
  tags: [],
  position: index + 1
}));
return [{ json: { items: stories } }];
```

---

### Product Hunt Workflow

数据源：GraphQL API（需要 Developer Token）

```
[Schedule Trigger]
      ↓
[HTTP] POST https://api.producthunt.com/v2/api/graphql
  Header: Authorization: Bearer __PRODUCT_HUNT_TOKEN__
  Body (GraphQL):
    {
      posts(first: 10, order: VOTES) {
        edges {
          node { name tagline url votesCount
            topics { edges { node { name } } }
          }
        }
      }
    }
      ↓
[Code] 展平 GraphQL 响应，格式化为标准 items
      ↓
[HTTP] Claude API
      ↓
[Code] 解析 Claude JSON 响应
      ↓
[HTTP] Webhook 回调 NestJS
```

**格式化节点代码**
```javascript
const posts = $json.data.posts.edges.map((edge, index) => ({
  title: edge.node.name,
  url: edge.node.url,
  summary: edge.node.tagline,
  score: edge.node.votesCount,
  tags: edge.node.topics.edges.map(t => t.node.name),
  position: index + 1
}));
return [{ json: { items: posts } }];
```

---

### GitHub Trending Workflow

数据源：非官方 API（免费，无需 token）

```
[Schedule Trigger]
      ↓
[HTTP] GET https://api.gitterapp.com/repositories?language=&since=daily
      ↓
[Code] slice(0, 10)，格式化为标准 items
      ↓
[HTTP] Claude API
      ↓
[Code] 解析 Claude JSON 响应
      ↓
[HTTP] Webhook 回调 NestJS
```

**格式化节点代码**
```javascript
const repos = $json.slice(0, 10).map((repo, index) => ({
  title: repo.fullname,
  url: repo.url,
  summary: repo.description,
  score: repo.stars,
  author: repo.author,
  tags: repo.language ? [repo.language] : [],
  position: index + 1
}));
return [{ json: { items: repos } }];
```

---

### Dev.to Workflow

数据源：官方 REST API（免费，无需 token）

```
[Schedule Trigger]
      ↓
[HTTP] GET https://dev.to/api/articles?top=7&per_page=10
      ↓
[Code] 格式化为标准 items
      ↓
[HTTP] Claude API
      ↓
[Code] 解析 Claude JSON 响应
      ↓
[HTTP] Webhook 回调 NestJS
```

**格式化节点代码**
```javascript
const articles = $json.map((article, index) => ({
  title: article.title,
  url: article.url,
  summary: article.description,
  score: article.positive_reactions_count,
  author: article.user.name,
  tags: article.tag_list,
  position: index + 1
}));
return [{ json: { items: articles } }];
```

---

## Cron 表达式

| 频率 | Cron | 说明 |
|------|------|------|
| daily | `0 8 * * *` | 每天早上 8:00 |
| weekly | `0 8 * * 1` | 每周一早上 8:00 |

---

## 错误处理

n8n workflow 中每个 HTTP Request 节点开启 `Continue On Fail`，在最后加一个 `IF` 节点判断是否有错误，有错误时跳过 Webhook 回调，避免存入脏数据。

执行失败可在 n8n 管理界面 Executions 页面查看详细日志。
