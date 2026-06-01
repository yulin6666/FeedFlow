# n8n 学习指南 —— 结合 FeedFlow 项目

## 什么是 n8n

n8n 是一个**可视化工作流自动化工具**。你在界面上把一个个"节点"连起来，就能实现：定时抓数据 → 处理数据 → 调用 AI → 把结果发给其他服务。

不需要写完整的程序，每个节点只做一件事，连起来就是一个完整的自动化流程。

---

## 界面解读（对照截图）

### 左侧导航栏

| 菜单项 | 作用 |
|--------|------|
| Overview | 所有工作流列表 |
| Chat | AI 对话功能（Preview） |
| Templates | n8n 官方提供的工作流模板库 |
| Insights | 执行统计和监控 |
| Settings | API Key、用户、环境变量等配置 |

### 顶部工具栏

| 元素 | 作用 |
|------|------|
| `Personal / FeedFlow - Product Hunt [fca5f447]` | 当前工作流的名称，`fca5f447` 是订阅 ID 的前 8 位 |
| `Editor / Executions / Evaluations` | 三个 Tab：编辑工作流 / 查看执行历史 / 评估测试 |
| `Published` | 工作流状态，Published = 已激活，会按 cron 定时运行 |
| `0 / 3` | 本月执行次数 / 总执行次数 |

### 画布中的节点

你在截图里看到的就是 FeedFlow 为 Product Hunt 订阅自动创建的工作流：

```
Schedule Trigger ──┐
                   ├──→ 获取 Product Hunt → 格式化数据 → AI 生成摘要 → 解析 AI 响应 → Webhook 回调 NestJS
Webhook Trigger  ──┘
```

---

## 节点详解

### 1. Schedule Trigger（时钟图标）

**作用：** 定时触发，相当于 cron job。

**在 FeedFlow 里怎么创建的：**

```typescript
// apps/backend/src/modules/n8n/workflow-templates.ts
function buildScheduleTrigger(frequency: Frequency): object {
  return {
    type: 'n8n-nodes-base.scheduleTrigger',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 8 * * *' }]
        //                                                  ↑ 每天早上 8:00 触发
      },
    },
  };
}
```

**Cron 表达式说明：**
```
0 8 * * *   → 每天 08:00
0 8 * * 1   → 每周一 08:00
* * * * *   → 每分钟
```

---

### 2. Webhook Trigger（粉色节点）

**作用：** 监听一个 HTTP 地址，有人 POST 这个地址就立刻触发工作流。

**在 FeedFlow 里的用途：** 用于"立刻触发"功能。前端点击触发按钮 → NestJS 调用 → POST 这个 webhook → 工作流立刻执行，不用等 cron。

**在 FeedFlow 里怎么创建的：**

```typescript
function buildWebhookTrigger(subscriptionId: string): object {
  return {
    type: 'n8n-nodes-base.webhook',
    parameters: {
      path: `feedflow-${subscriptionId}`,  // webhook 路径，每个订阅唯一
      httpMethod: 'POST',
      responseMode: 'onReceived',          // 收到请求立即返回，不等工作流跑完
    },
  };
}
```

**触发地址：** `http://localhost:5678/webhook/feedflow-{subscriptionId}`

NestJS 里触发它的代码：
```typescript
// apps/backend/src/modules/n8n/n8n.service.ts
async triggerWorkflow(subscriptionId: string): Promise<string> {
  const webhookPath = getWebhookPath(subscriptionId);  // feedflow-{id}
  const res = await axios.post(`${baseURL}/webhook/${webhookPath}`, { trigger: 'manual' });
  return res.data?.executionId ?? 'triggered';
}
```

---

### 3. 获取 Product Hunt（蓝色地球图标 = HTTP Request）

**作用：** 发一个 HTTP 请求，拿回数据。

**在 FeedFlow 里：** 调用 Product Hunt GraphQL API，获取今日 Top 10 产品。

```typescript
{
  type: 'n8n-nodes-base.httpRequest',
  parameters: {
    method: 'POST',
    url: 'https://api.producthunt.com/v2/api/graphql',
    // 请求体是 GraphQL 查询
    jsonBody: JSON.stringify({
      query: `{ posts(first: 10, order: VOTES) {
        edges { node { name tagline url votesCount } }
      }}`
    }),
  },
}
```

节点输出的数据会自动传给下一个节点，用 `$json` 访问。

---

### 4. 格式化数据（橙色花括号 = Code）

**作用：** 写 JavaScript 代码处理数据，把上一个节点的输出转换成你想要的格式。

**在 FeedFlow 里：** 把 GraphQL 返回的嵌套结构拍平，变成统一的 `items` 数组。

```javascript
// 这段代码运行在 n8n 的 Code 节点里
const posts = $input.first().json.data.posts.edges.map((edge, index) => ({
  title: edge.node.name,
  url: edge.node.url,
  summary: edge.node.tagline,
  score: edge.node.votesCount,
  position: index + 1
}));
return [{ json: { items: posts } }];
//              ↑ 必须返回这种格式，n8n 才能传给下一个节点
```

**关键语法：**
- `$input.first().json` — 获取上一个节点的第一条数据
- `$input.all()` — 获取上一个节点的所有数据（数组）
- `return [{ json: {...} }]` — 必须返回数组，每个元素是 `{ json: 数据 }`

---

### 5. AI 生成摘要（蓝色地球 = HTTP Request）

**作用：** 调用 DeepSeek API，把 items 数组发给 AI，让它生成中文摘要。

```typescript
{
  type: 'n8n-nodes-base.httpRequest',
  parameters: {
    url: 'https://api.deepseek.com/chat/completions',
    jsonBody: `={
      "model": "deepseek-chat",
      "messages": [{
        "role": "user",
        "content": "...请生成摘要...\n\n" + JSON.stringify($json.items)
        //                                              ↑ 引用上一节点的数据
      }]
    }`,
  },
}
```

注意 `={...}` 开头的写法：这是 n8n 的**表达式语法**，`=` 开头表示这是动态值，可以用 `$json`、`$input` 等变量。

---

### 6. 解析 AI 响应（橙色花括号 = Code）

**作用：** AI 返回的是字符串，需要解析成 JSON 对象。

```javascript
const raw = $input.first().json.choices[0].message.content;
// 去掉 AI 可能返回的 markdown 代码块包裹
const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
try {
  return [{ json: JSON.parse(cleaned) }];
} catch(e) {
  return [{ json: { summary: raw, items: [] } }];
}
```

---

### 7. Webhook 回调 NestJS（蓝色地球 = HTTP Request）

**作用：** 把处理好的摘要 POST 回 NestJS，NestJS 存入数据库。

```typescript
{
  url: 'http://localhost:3000/api/v1/webhook/n8n/digest-complete',
  headers: { 'X-Webhook-Secret': 'feedflow_secret_2024' },
  jsonBody: {
    subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // 硬编码，模板生成时写入
    status: 'completed',
    summary: '={{ $json.summary }}',
    content: '={{ JSON.stringify($json.items) }}',
    n8nExecutionId: '={{ $execution.id }}',
  },
}
```

> **为什么用 `subscriptionId` 而不是 `digestId`？**
>
> 工作流有两个触发入口（Schedule Trigger 和 Webhook Trigger）。如果用 `$("Webhook Trigger").first().json.digestId`，当 Schedule Trigger 触发时 Webhook Trigger 节点未执行，表达式会报错。
>
> 改为在模板生成时把 `subscriptionId` 硬编码进 callback 节点，两种触发路径都能正常工作。NestJS 收到后自己创建 digest 记录再写入内容。

NestJS 接收这个回调的代码：
```typescript
// apps/backend/src/modules/webhook/webhook.controller.ts
@Post('n8n/digest-complete')
async handleDigestComplete(
  @Body() payload: N8nWebhookPayloadDto,
  @Headers('x-webhook-secret') secret: string,
) {
  // 验证 secret
  // 先创建 digest 记录，再写入内容
  const digest = await this.digestsService.create(payload.subscriptionId);
  await this.digestsService.updateStatus(digest.id, payload.status, {
    content: payload.content,
    summary: payload.summary,
    n8nExecutionId: payload.n8nExecutionId,
  });
}
```

---

## 整体数据流

```
用户在前端创建订阅
        ↓
NestJS POST /api/v1/subscriptions
        ↓
N8nService.createWorkflow()
  ├─ 调用 n8n API 创建工作流 JSON（subscriptionId 硬编码进 callback 节点）
  └─ 激活工作流（POST /activate）
        ↓
n8n 工作流开始监听（Schedule + Webhook 两个入口）
        ↓
触发（定时 or 手动）
        ↓
获取数据源 → 格式化 → DeepSeek AI → 解析 → 回调 NestJS（带 subscriptionId）
        ↓
NestJS 创建 Digest 记录 → 写入摘要内容 → 存入 PostgreSQL
        ↓
前端查询摘要历史展示
```

---

## n8n 表达式语法速查

| 语法 | 含义 | 示例 |
|------|------|------|
| `$json` | 当前节点输入的 JSON 数据 | `$json.title` |
| `$input.first().json` | 上一节点第一条数据 | `$input.first().json.items` |
| `$input.all()` | 上一节点所有数据 | `$input.all().map(i => i.json)` |
| `$execution.id` | 当前执行 ID | 用于追踪日志 |
| `={{ 表达式 }}` | 在字符串里嵌入动态值 | `"={{ $json.summary }}"` |
| `={ JSON }` | 整个字段是动态表达式 | `jsonBody: "={ ... }"` |

---

## 如何在 n8n 界面手动测试

1. 打开 http://localhost:5678
2. 点击 **FeedFlow - Product Hunt** 工作流
3. 点击底部橙色按钮 **Execute workflow from Webhook Trigger**
4. 观察每个节点变绿（成功）或变红（失败）
5. 点击任意节点可以看到该节点的输入/输出数据
6. 点击顶部 **Executions** Tab 查看历史执行记录

---

## NestJS 如何通过 API 管理 n8n

FeedFlow 里 NestJS 完全通过 REST API 控制 n8n，不需要手动在界面操作：

```typescript
// apps/backend/src/modules/n8n/n8n.service.ts

// 创建工作流（用户订阅时自动调用）
await this.client.post('/api/v1/workflows', workflowDef);

// 激活工作流（创建后立即激活）
await this.client.post(`/api/v1/workflows/${workflowId}/activate`);

// 删除工作流（用户取消订阅时自动调用）
await this.client.delete(`/api/v1/workflows/${workflowId}`);

// 查看执行记录
await this.client.get('/api/v1/executions', { params: { workflowId } });
```

认证方式：每个请求带 `X-N8N-API-KEY` header，Key 在 n8n 界面 Settings → API 里生成。

---

## 常见问题

**Q: 工作流创建了但没有执行？**
检查工作流是否是 Published（激活）状态，右上角显示绿色 Published 才会定时运行。

**Q: 节点报错怎么看？**
点击 Executions Tab → 找到失败的执行 → 点进去 → 红色节点上有错误详情。

**Q: 想修改 cron 时间怎么办？**
直接在 n8n 界面点击 Schedule Trigger 节点 → 修改 cron 表达式 → 保存。或者通过 NestJS 的 `updateWorkflowSchedule` 方法用 API 修改。

**Q: 为什么有两个 Trigger？**
- Schedule Trigger：定时自动运行（每天/每周）
- Webhook Trigger：手动触发，前端点"立刻更新"按钮时调用

**Q: callback 节点为什么不用 `$("Webhook Trigger")` 取 digestId？**
当 Schedule Trigger 触发时，Webhook Trigger 节点没有执行，引用它会报 "node is unexecuted" 错误。解决方案是把 `subscriptionId` 在模板生成时硬编码进 callback 节点，NestJS 收到后负责创建 digest 记录。

**Q: 已有的旧工作流怎么更新？**
旧工作流是用旧模板生成的，需要删除订阅再重新创建，新模板才会生效。或者在 n8n 界面手动修改 callback 节点的 JSON body，把 `digestId: '={{ $execution.id }}'` 改为 `subscriptionId: '你的订阅UUID'`。
