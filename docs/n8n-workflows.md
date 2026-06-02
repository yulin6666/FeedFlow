# n8n Workflow 设计文档

## 概述

每个 subscription 对应一个独立的 n8n workflow。用户创建订阅时，NestJS 自动调用 n8n REST API 创建并激活 workflow；删除订阅时自动删除对应 workflow。

所有 workflow 共用相同的节点结构：

```
Schedule Trigger ──┐
                   ├──→ [数据获取链] ──→ AI 生成摘要 ──→ 解析 AI 响应 ──→ Webhook 回调 NestJS
Webhook Trigger  ──┘
```

- **数据获取链**：因数据源不同而变化（1~5 个节点）
- **AI 处理链**：所有数据源完全相同（固定 3 个节点）

---

## 一、NestJS 如何管理 n8n

### 1. 认证配置

NestJS 在 `N8nService` 构造函数里创建一个预配置的 axios 实例，后续所有请求都复用它：

```typescript
// apps/backend/src/modules/n8n/n8n.service.ts
this.client = axios.create({
  baseURL: 'http://localhost:5678',  // 本地开发；生产环境改为 Docker 内网地址
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': apiKey,         // n8n Settings → API 里生成的 Key
  },
});
```

API Key 从环境变量读取：
```bash
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key
```

---

### 2. 核心 API 操作

| 操作 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建 workflow | POST | `/api/v1/workflows` | body 是完整 workflow JSON |
| 激活 workflow | POST | `/api/v1/workflows/:id/activate` | 激活后 cron 才开始运行 |
| 更新 workflow | PUT | `/api/v1/workflows/:id` | 更新 cron 频率时使用 |
| 删除 workflow | DELETE | `/api/v1/workflows/:id` | 用户取消订阅时调用 |
| 查询所有 workflow | GET | `/api/v1/workflows` | 管理界面用 |
| 查询执行历史 | GET | `/api/v1/executions` | 可传 `?workflowId=` 过滤 |

---

### 3. 创建 workflow 的完整流程

用户创建订阅时触发，代码在 `subscriptions.service.ts`：

```typescript
// 1. 先保存订阅到数据库
const saved = await this.subscriptionRepo.save(subscription);

// 2. 异步创建 n8n workflow（不阻塞接口响应）
this.n8nService
  .createWorkflow(saved.id, saved.source, saved.frequency)
  .then((workflowId) => {
    saved.n8nWorkflowId = workflowId;  // 把 n8n workflow ID 存回数据库
    return this.subscriptionRepo.save(saved);
  })
  .catch((err) => {
    this.logger.error(`Failed to create n8n workflow`, err);
  });
```

`createWorkflow` 内部做了两件事：

```typescript
// apps/backend/src/modules/n8n/n8n.service.ts
async createWorkflow(subscriptionId, source, frequency): Promise<string> {
  // 第一步：生成 workflow JSON
  const workflowDef = buildWorkflow(source, {
    subscriptionId,
    frequency,
    backendUrl,
    webhookSecret,
    aiApiKey,
  });

  // 第二步：POST 到 n8n，创建 workflow
  const createRes = await this.client.post('/api/v1/workflows', workflowDef);
  const workflowId = createRes.data.id;

  // 第三步：激活（刚创建的 workflow 默认未激活，不会定时运行）
  await this.client.post(`/api/v1/workflows/${workflowId}/activate`);

  return workflowId;
}
```

---

### 4. 手动触发 workflow

前端点击"立刻更新"按钮时，调用 `POST /api/v1/subscriptions/:id/trigger`，最终执行：

```typescript
async triggerWorkflow(subscriptionId: string): Promise<string> {
  const webhookPath = `feedflow-${subscriptionId}`;
  // 直接 POST 到 workflow 里的 Webhook Trigger 节点地址
  const res = await axios.post(`${baseURL}/webhook/${webhookPath}`, { trigger: 'manual' });
  return res.data?.executionId ?? 'triggered';
}
```

注意：手动触发走的是 **Webhook Trigger 节点**，不是 n8n 的 `/run` API。

---

### 5. 更新 cron 频率

用户修改订阅频率时调用：

```typescript
async updateWorkflowSchedule(workflowId: string, frequency: Frequency): Promise<void> {
  // 先 GET 拿到完整 workflow 定义
  const workflow = await this.client.get(`/api/v1/workflows/${workflowId}`);
  const nodes = workflow.data.nodes;

  // 找到 Schedule Trigger 节点，修改 cron 表达式
  const triggerNode = nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger');
  triggerNode.parameters.rule.interval[0].expression = cronMap[frequency];

  // PUT 回去更新
  await this.client.put(`/api/v1/workflows/${workflowId}`, { ...workflow.data, nodes });
}
```

---

## 二、Workflow JSON 结构

每个 workflow JSON 包含三个顶层字段：

```typescript
{
  name: "FeedFlow - Dev.to [fca5f447]",  // 工作流名称（含订阅 ID 前 8 位）
  nodes: [...],                           // 节点数组
  connections: {...},                     // 节点连接关系
  settings: { executionOrder: 'v1' },    // 执行顺序（v1 = 按拓扑排序）
}
```

### nodes 数组

每个节点的通用字段：

```typescript
{
  id: 'fetch_devto',                    // 节点唯一 ID（内部使用）
  name: '获取 Dev.to 文章',              // 显示名称（connections 里用这个建立连接）
  type: 'n8n-nodes-base.httpRequest',  // 节点类型
  typeVersion: 4.2,                     // 节点版本
  position: [320, 280],                 // 画布坐标 [x, y]，纯视觉，不影响执行
  parameters: { ... },                  // 节点配置
}
```

### connections 对象

描述数据流向，key 是出发节点名，value 是目标节点：

```typescript
{
  "节点A": {
    "main": [[{ "node": "节点B", "type": "main", "index": 0 }]]
  }
}
```

三层嵌套的含义：
- 第一层 `main`：输出端口名（一个节点可以有多个端口）
- 第二层 `[...]`：分支列表（IF 节点有 true/false 两条分支）
- 第三层 `[{...}]`：目标节点列表（一条分支可以并行连多个节点）

FeedFlow 里每个节点都是单输出单目标，所以始终是 `[[{ node: "..." }]]`。

---

## 三、公共节点详解

### Schedule Trigger

```typescript
{
  id: 'schedule_trigger',
  name: 'Schedule Trigger',
  type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.2,
  position: [100, 180],
  parameters: {
    rule: {
      interval: [{ field: 'cronExpression', expression: '0 8 * * *' }]
    },
  },
}
```

| 频率 | Cron 表达式 | 说明 |
|------|-------------|------|
| daily | `0 8 * * *` | 每天早上 8:00 |
| weekly | `0 8 * * 1` | 每周一早上 8:00 |
| realtime | `0 * * * *` | 每小时 |

---

### Webhook Trigger

```typescript
{
  id: 'webhook_trigger',
  name: 'Webhook Trigger',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [100, 380],
  webhookId: subscriptionId,  // 与订阅 ID 绑定
  parameters: {
    path: `feedflow-${subscriptionId}`,  // 每个订阅唯一的路径
    httpMethod: 'POST',
    responseMode: 'onReceived',          // 收到请求立即返回，不等工作流跑完
  },
}
```

触发地址：`http://localhost:5678/webhook/feedflow-{subscriptionId}`

`responseMode: 'onReceived'` 的作用：NestJS 调用这个地址后立即得到响应，不会等待整个工作流执行完（工作流可能要跑几秒到几十秒）。

---

### AI 生成摘要

```typescript
{
  id: 'ai_summarize',
  name: 'AI 生成摘要',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  parameters: {
    method: 'POST',
    url: 'https://api.deepseek.com/chat/completions',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: `Bearer ${aiApiKey}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: {
      model: 'deepseek-chat',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: '={{ $json.aiPrompt }}',  // 引用上一节点构造好的 prompt
      }],
    },
  },
}
```

`$json.aiPrompt` 是"格式化数据"节点输出的字段，包含文章列表和指令。

---

### 解析 AI 响应

```typescript
{
  id: 'parse_ai',
  name: '解析 AI 响应',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  parameters: {
    jsCode: `
const raw = $input.first().json.choices[0].message.content;
// AI 有时会用 \`\`\`json ... \`\`\` 包裹返回值，需要去掉
const cleaned = raw.replace(/^\`\`\`json\\n?/, '').replace(/\\n?\`\`\`$/, '');
try {
  return [{ json: JSON.parse(cleaned) }];
} catch(e) {
  // 解析失败时把原始文本作为 summary 返回，不让工作流中断
  return [{ json: { summary: raw, items: [] } }];
}
    `.trim(),
  },
}
```

输出格式：`{ summary: "整体趋势总结", items: [{title, url, summary}, ...] }`

---

### Webhook 回调 NestJS

```typescript
{
  id: 'callback',
  name: 'Webhook 回调 NestJS',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  parameters: {
    method: 'POST',
    url: `${backendUrl}/api/v1/webhook/n8n/digest-complete`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'X-Webhook-Secret', value: webhookSecret },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: {
      subscriptionId: subscriptionId,          // 硬编码，模板生成时写入
      status: 'completed',
      summary: '={{ $json.summary }}',         // 引用解析 AI 响应节点的输出
      content: '={{ JSON.stringify($json.items) }}',
      n8nExecutionId: '={{ $execution.id }}',  // n8n 执行 ID，用于追踪
    },
  },
}
```

> **为什么用 `subscriptionId` 而不是 `digestId`？**
>
> 工作流有两个触发入口。如果用 `$("Webhook Trigger").first().json.digestId`，当 Schedule Trigger 触发时 Webhook Trigger 节点未执行，n8n 会报 "node is unexecuted" 错误。
>
> 改为把 `subscriptionId` 在模板生成时硬编码进节点，两种触发路径都能正常工作。NestJS 收到回调后自己创建 digest 记录再写入内容。

NestJS 收到回调后的处理：

```typescript
// apps/backend/src/modules/webhook/webhook.controller.ts
@Post('n8n/digest-complete')
async handleDigestComplete(@Body() payload, @Headers('x-webhook-secret') secret) {
  // 1. 验证 secret
  if (expectedSecret && secret !== expectedSecret) throw new UnauthorizedException();

  // 2. 创建 digest 记录
  const digest = await this.digestsService.create(payload.subscriptionId);

  // 3. 写入摘要内容
  await this.digestsService.updateStatus(digest.id, payload.status, {
    content: payload.content,
    summary: payload.summary,
    n8nExecutionId: payload.n8nExecutionId,
  });
}
```

---

## 四、各数据源 Workflow 详解

### 连接关系的构建方式

所有数据源共用 `buildDataConnections` 函数，传入"可变的数据获取链"，自动拼接固定的 AI 处理链：

```typescript
function buildDataConnections(fetchNodeName: string, extraNodes: string[] = []) {
  const chain = [fetchNodeName, ...extraNodes];
  // chain 的最后一个节点自动连到 'AI 生成摘要'
  // 'AI 生成摘要' → '解析 AI 响应' → 'Webhook 回调 NestJS' 固定不变
}
```

---

### Dev.to

**数据源**：官方 REST API，免费无需 token

```
Schedule Trigger ──┐
                   ├──→ 获取 Dev.to 文章 ──→ 格式化数据 ──→ AI 生成摘要 ──→ 解析 AI 响应 ──→ Webhook 回调 NestJS
Webhook Trigger  ──┘
```

```typescript
buildDataConnections('获取 Dev.to 文章', ['格式化数据'])
// chain = ['获取 Dev.to 文章', '格式化数据']
```

**获取节点**：
```
GET https://dev.to/api/articles?top=7&per_page=10
```
返回最近 7 天热门的 10 篇文章数组。

**格式化节点**：
```javascript
const all = $input.all();
// 兼容两种返回格式：单条包含数组 or 多条各含一个对象
let rawArticles;
if (all.length === 1 && Array.isArray(all[0].json)) {
  rawArticles = all[0].json;
} else {
  rawArticles = all.map(item => item.json);
}
const articles = rawArticles.map((article, index) => ({
  title: article.title,
  url: article.url,
  summary: article.description || '',
  score: article.positive_reactions_count || 0,
  author: article.user?.name || '',
  tags: article.tag_list || [],
  position: index + 1
}));
const aiPrompt = '以下是今日热门内容...' + JSON.stringify(articles);
return [{ json: { items: articles, aiPrompt } }];
```

---

### GitHub Trending

**数据源**：非官方 API（gitterapp.com），免费无需 token

```
Schedule Trigger ──┐
                   ├──→ 获取 GitHub Trending ──→ 格式化数据 ──→ AI 生成摘要 ──→ 解析 AI 响应 ──→ Webhook 回调 NestJS
Webhook Trigger  ──┘
```

```typescript
buildDataConnections('获取 GitHub Trending', ['格式化数据'])
// chain = ['获取 GitHub Trending', '格式化数据']
```

**获取节点**：
```
GET https://api.gitterapp.com/repositories?language=&since=daily
```

**格式化节点**：
```javascript
const repos = $input.first().json.slice(0, 10).map((repo, index) => ({
  title: repo.fullname || repo.name,
  url: repo.url || `https://github.com/${repo.fullname}`,
  summary: repo.description || '',
  score: repo.stars || 0,
  author: repo.author || '',
  tags: repo.language ? [repo.language] : [],
  position: index + 1
}));
```

---

### Hacker News

**数据源**：Firebase REST API，免费无需 token

**节点最多（5个）**，因为 HN API 只能逐条获取文章详情：

```
Schedule Trigger ──┐
                   ├──→ 获取 Top Stories ──→ 取前 10 条 ID ──→ 获取每条详情 ──→ 聚合结果 ──→ 格式化数据
Webhook Trigger  ──┘                                                                              ↓
                                                                                          AI 生成摘要 → ...
```

```typescript
buildDataConnections('获取 Top Stories', ['取前 10 条 ID', '获取每条详情', '聚合结果', '格式化数据'])
// chain = ['获取 Top Stories', '取前 10 条 ID', '获取每条详情', '聚合结果', '格式化数据']
```

**各节点说明**：

| 节点 | 类型 | 作用 |
|------|------|------|
| 获取 Top Stories | httpRequest | `GET .../topstories.json` → 返回 500 个 ID 的数组 |
| 取前 10 条 ID | code | `ids.slice(0, 10).map(id => ({ json: { id } }))` → 拆成 10 条 |
| 获取每条详情 | httpRequest | `GET .../item/{{ $json.id }}.json` → 每条 ID 请求一次，共 10 次 |
| 聚合结果 | aggregate | 把 10 条结果合并成一个数组 `{ items: [...] }` |
| 格式化数据 | code | 统一字段格式，构造 aiPrompt |

**取前 10 条 ID 节点代码**：
```javascript
const all = $input.all();
let ids;
if (all.length === 1 && Array.isArray(all[0].json)) {
  ids = all[0].json;
} else {
  ids = all.map(item => item.json);
}
return ids.slice(0, 10).map(id => ({ json: { id } }));
// 输出 10 条，每条是 { json: { id: 12345 } }
// 下一个 httpRequest 节点会对每条分别发请求
```

**聚合节点配置**：
```typescript
{
  type: 'n8n-nodes-base.aggregate',
  parameters: {
    aggregate: 'aggregateAllItemData',
    destinationFieldName: 'items',
    include: 'allFields',
  },
}
// 把 10 条 { json: { title, url, score... } } 合并成 { json: { items: [...] } }
```

---

### Product Hunt

**数据源**：官方 GraphQL API，需要 Developer Token

```
Schedule Trigger ──┐
                   ├──→ 获取 PH Token ──→ 获取 Product Hunt ──→ 格式化数据 ──→ AI 生成摘要 → ...
Webhook Trigger  ──┘
```

```typescript
buildDataConnections('获取 PH Token', ['获取 Product Hunt', '格式化数据'])
// chain = ['获取 PH Token', '获取 Product Hunt', '格式化数据']
```

**获取 Token 节点**：
```
POST https://api.producthunt.com/v2/oauth/token
Body: { client_id, client_secret, grant_type: 'client_credentials' }
返回: { access_token: "..." }
```

**获取数据节点**：
```
POST https://api.producthunt.com/v2/api/graphql
Authorization: Bearer {{ $json.access_token }}
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
```

**格式化节点**：
```javascript
const posts = $input.first().json.data.posts.edges.map((edge, index) => ({
  title: edge.node.name,
  url: edge.node.url,
  summary: edge.node.tagline,
  score: edge.node.votesCount,
  tags: edge.node.topics.edges.map(t => t.node.name),
  position: index + 1
}));
```

---

## 五、统一的数据格式

所有数据源的"格式化数据"节点都输出相同的结构，供后续 AI 节点和前端使用：

```typescript
interface UnifiedItem {
  title: string;    // 标题
  url: string;      // 原文链接
  summary: string;  // 简介（格式化时填入，AI 会覆盖）
  score: number;    // 热度分数（HN 的 score、PH 的 votesCount、Dev.to 的 reactions）
  author: string;   // 作者
  tags: string[];   // 标签
  position: number; // 排名（从 1 开始）
}
```

格式化节点的输出：
```typescript
return [{ json: { items: UnifiedItem[], aiPrompt: string } }];
```

AI 节点处理后的输出：
```typescript
return [{ json: { summary: string, items: UnifiedItem[] } }];
// summary 是 AI 生成的整体趋势总结
// items 里每条的 summary 字段被 AI 替换成中文摘要
```

---

## 六、n8n 表达式语法速查

在节点的 `parameters` 里，以 `={{` 开头的字符串是动态表达式：

| 语法 | 含义 | 示例 |
|------|------|------|
| `={{ $json.field }}` | 当前节点输入的字段 | `={{ $json.summary }}` |
| `={{ $input.first().json.field }}` | 上一节点第一条数据 | `={{ $input.first().json.items }}` |
| `={{ $input.all() }}` | 上一节点所有数据 | 在 Code 节点里用 `$input.all()` |
| `={{ $execution.id }}` | 当前执行 ID（数字） | 用于追踪日志 |
| `={{ JSON.stringify($json.items) }}` | 序列化为 JSON 字符串 | callback 节点的 content 字段 |
| `={{ $("节点名").first().json }}` | 引用指定节点的输出 | 跨节点取数据（注意：节点必须已执行） |

> **注意**：`$("节点名")` 只能引用在当前执行路径上已经执行过的节点。Schedule Trigger 触发时，Webhook Trigger 节点未执行，引用它会报错。

---

## 七、调试指南

### 在 n8n 界面手动测试

1. 打开 `http://localhost:5678`
2. 找到对应的 FeedFlow workflow
3. 点击画布底部 **"Test workflow"** 按钮
4. 观察每个节点：绿色 = 成功，红色 = 失败
5. 点击任意节点查看该节点的输入/输出数据
6. 点击顶部 **Executions** Tab 查看历史执行记录

### 常见错误排查

**错误：node is unexecuted**
- 原因：表达式引用了未执行的节点（如 Schedule Trigger 路径下引用 Webhook Trigger）
- 解决：改用硬编码值或从已执行节点取数据

**错误：invalid input syntax for type uuid**
- 原因：把 `$execution.id`（数字）当作 UUID 传给数据库
- 解决：用 `subscriptionId`（硬编码的 UUID）替代

**错误：workflow 创建成功但不执行**
- 原因：workflow 未激活（Published 状态）
- 解决：检查 `createWorkflow` 里是否调用了 `/activate`

**错误：手动触发返回 404**
- 原因：Webhook Trigger 节点的 path 不对，或 workflow 未激活
- 解决：确认 path 是 `feedflow-{subscriptionId}`，且 workflow 是 Published 状态

### 查看执行日志

```typescript
// 通过 NestJS API 查询
GET /api/v1/n8n/executions?workflowId=xxx

// 或直接在 n8n 界面
http://localhost:5678 → 对应 workflow → Executions Tab
```
