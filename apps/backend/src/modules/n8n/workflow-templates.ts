import { FeedSource, Frequency } from '../subscriptions/subscription.entity';

const CRON_MAP: Record<Frequency, string> = {
  [Frequency.DAILY]: '0 8 * * *',
  [Frequency.WEEKLY]: '0 8 * * 1',
  [Frequency.REALTIME]: '0 * * * *',
};

interface TemplateVars {
  subscriptionId: string;
  frequency: Frequency;
  backendUrl: string;
  webhookSecret: string;
  aiApiKey: string;
  productHuntApiKey?: string;
  productHuntApiSecret?: string;
}

export interface WorkflowCreated {
  workflowId: string;
  webhookPath: string;
}

// ─── 公共节点 ────────────────────────────────────────────────────────────────

function buildScheduleTrigger(frequency: Frequency): object {
  return {
    id: 'schedule_trigger',
    name: 'Schedule Trigger',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [100, 180],
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: CRON_MAP[frequency] }],
      },
    },
  };
}

function buildWebhookTrigger(subscriptionId: string): object {
  return {
    id: 'webhook_trigger',
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [100, 380],
    webhookId: subscriptionId,
    parameters: {
      path: `feedflow-${subscriptionId}`,
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  };
}

function buildAiNode(aiApiKey: string, position: [number, number]): object {
  return {
    id: 'ai_summarize',
    name: 'AI 生成摘要',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
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
        messages: [
          {
            role: 'user',
            content: '={{ $json.aiPrompt }}',
          },
        ],
      },
      options: {},
    },
  };
}

function buildParseAiNode(position: [number, number]): object {
  return {
    id: 'parse_ai',
    name: '解析 AI 响应',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: {
      jsCode: `
const raw = $input.first().json.choices[0].message.content;
const cleaned = raw.replace(/^\`\`\`json\\n?/, '').replace(/\\n?\`\`\`$/, '');
try {
  return [{ json: JSON.parse(cleaned) }];
} catch(e) {
  return [{ json: { summary: raw, items: [] } }];
}
      `.trim(),
    },
  };
}

function buildCallbackNode(
  backendUrl: string,
  webhookSecret: string,
  subscriptionId: string,
  position: [number, number],
): object {
  return {
    id: 'callback',
    name: 'Webhook 回调 NestJS',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
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
        subscriptionId,
        status: 'completed',
        summary: '={{ $json.summary }}',
        content: '={{ JSON.stringify($json.items) }}',
        n8nExecutionId: '={{ $execution.id }}',
      },
      options: {},
    },
  };
}

// 公共连接：数据节点 → AI → 解析 → 回调
function buildDataConnections(
  fetchNodeName: string,
  extraNodes: string[] = [],
): Record<string, object> {
  const chain = [fetchNodeName, ...extraNodes];
  const conn: Record<string, object> = {
    'Schedule Trigger': { main: [[{ node: chain[0], type: 'main', index: 0 }]] },
    'Webhook Trigger': { main: [[{ node: chain[0], type: 'main', index: 0 }]] },
  };
  for (let i = 0; i < chain.length - 1; i++) {
    conn[chain[i]] = { main: [[{ node: chain[i + 1], type: 'main', index: 0 }]] };
  }
  const last = chain[chain.length - 1];
  conn[last] = { main: [[{ node: 'AI 生成摘要', type: 'main', index: 0 }]] };
  conn['AI 生成摘要'] = { main: [[{ node: '解析 AI 响应', type: 'main', index: 0 }]] };
  conn['解析 AI 响应'] = { main: [[{ node: 'Webhook 回调 NestJS', type: 'main', index: 0 }]] };
  return conn;
}

// ─── Hacker News ─────────────────────────────────────────────────────────────

function buildHackerNewsWorkflow(vars: TemplateVars): object {
  const { subscriptionId, frequency, backendUrl, webhookSecret, aiApiKey } = vars;
  return {
    name: `FeedFlow - Hacker News [${subscriptionId.slice(0, 8)}]`,
    nodes: [
      buildScheduleTrigger(frequency),
      buildWebhookTrigger(subscriptionId),
      {
        id: 'fetch_top',
        name: '获取 Top Stories',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [320, 280],
        parameters: {
          method: 'GET',
          url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
          options: {},
        },
      },
      {
        id: 'slice_ids',
        name: '取前 10 条 ID',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [520, 280],
        parameters: {
          jsCode: `
const all = $input.all();
// n8n 可能把数组拆成多条 items，也可能作为单条返回
let ids;
if (all.length === 1 && Array.isArray(all[0].json)) {
  ids = all[0].json;
} else {
  ids = all.map(item => item.json);
}
return ids.slice(0, 10).map(id => ({ json: { id } }));
          `.trim(),
        },
      },
      {
        id: 'fetch_item',
        name: '获取每条详情',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [720, 280],
        parameters: {
          method: 'GET',
          url: '=https://hacker-news.firebaseio.com/v0/item/{{ $json.id }}.json',
          options: {},
        },
      },
      {
        id: 'aggregate',
        name: '聚合结果',
        type: 'n8n-nodes-base.aggregate',
        typeVersion: 1,
        position: [920, 280],
        parameters: {
          aggregate: 'aggregateAllItemData',
          destinationFieldName: 'items',
          include: 'allFields',
        },
      },
      {
        id: 'format',
        name: '格式化数据',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1120, 280],
        parameters: {
          jsCode: `
const stories = $input.first().json.items.map((item, index) => ({
  title: item.title || '',
  url: item.url || \`https://news.ycombinator.com/item?id=\${item.id}\`,
  score: item.score || 0,
  author: item.by || '',
  tags: [],
  position: index + 1
}));
const aiPrompt = '以下是今日热门内容，请用中文为每条生成一句话摘要，并给出整体趋势总结。返回严格 JSON 格式：{ "summary": "整体摘要", "items": [{"title": "", "url": "", "summary": ""}] }\\n\\n' + JSON.stringify(stories);
return [{ json: { items: stories, aiPrompt } }];
          `.trim(),
        },
      },
      buildAiNode(aiApiKey, [1320, 280]),
      buildParseAiNode([1520, 280]),
      buildCallbackNode(backendUrl, webhookSecret, subscriptionId, [1720, 280]),
    ],
    connections: buildDataConnections('获取 Top Stories', [
      '取前 10 条 ID',
      '获取每条详情',
      '聚合结果',
      '格式化数据',
    ]),
    settings: { executionOrder: 'v1' },
  };
}

// ─── GitHub Trending ─────────────────────────────────────────────────────────

function buildGithubTrendingWorkflow(vars: TemplateVars): object {
  const { subscriptionId, frequency, backendUrl, webhookSecret, aiApiKey } = vars;
  return {
    name: `FeedFlow - GitHub Trending [${subscriptionId.slice(0, 8)}]`,
    nodes: [
      buildScheduleTrigger(frequency),
      buildWebhookTrigger(subscriptionId),
      {
        id: 'fetch_trending',
        name: '获取 GitHub Trending',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [320, 280],
        parameters: {
          method: 'GET',
          url: 'https://api.gitterapp.com/repositories?language=&since=daily',
          options: {},
        },
      },
      {
        id: 'format',
        name: '格式化数据',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [520, 280],
        parameters: {
          jsCode: `
const repos = $input.first().json.slice(0, 10).map((repo, index) => ({
  title: repo.fullname || repo.name,
  url: repo.url || \`https://github.com/\${repo.fullname}\`,
  summary: repo.description || '',
  score: repo.stars || 0,
  author: repo.author || '',
  tags: repo.language ? [repo.language] : [],
  position: index + 1
}));
const aiPrompt = '以下是今日热门内容，请用中文为每条生成一句话摘要，并给出整体趋势总结。返回严格 JSON 格式：{ "summary": "整体摘要", "items": [{"title": "", "url": "", "summary": ""}] }\\n\\n' + JSON.stringify(repos);
return [{ json: { items: repos, aiPrompt } }];
          `.trim(),
        },
      },
      buildAiNode(aiApiKey, [720, 280]),
      buildParseAiNode([920, 280]),
      buildCallbackNode(backendUrl, webhookSecret, subscriptionId, [1120, 280]),
    ],
    connections: buildDataConnections('获取 GitHub Trending', ['格式化数据']),
    settings: { executionOrder: 'v1' },
  };
}

// ─── Dev.to ──────────────────────────────────────────────────────────────────

function buildDevtoWorkflow(vars: TemplateVars): object {
  const { subscriptionId, frequency, backendUrl, webhookSecret, aiApiKey } = vars;
  return {
    name: `FeedFlow - Dev.to [${subscriptionId.slice(0, 8)}]`,
    nodes: [
      buildScheduleTrigger(frequency),
      buildWebhookTrigger(subscriptionId),
      {
        id: 'fetch_devto',
        name: '获取 Dev.to 文章',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [320, 280],
        parameters: {
          method: 'GET',
          url: 'https://dev.to/api/articles?top=7&per_page=10',
          options: {},
        },
      },
      {
        id: 'format',
        name: '格式化数据',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [520, 280],
        parameters: {
          jsCode: `
const all = $input.all();
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
const aiPrompt = '以下是今日热门内容，请用中文为每条生成一句话摘要，并给出整体趋势总结。返回严格 JSON 格式：{ "summary": "整体摘要", "items": [{"title": "", "url": "", "summary": ""}] }\\n\\n' + JSON.stringify(articles);
return [{ json: { items: articles, aiPrompt } }];
          `.trim(),
        },
      },
      buildAiNode(aiApiKey, [720, 280]),
      buildParseAiNode([920, 280]),
      buildCallbackNode(backendUrl, webhookSecret, subscriptionId, [1120, 280]),
    ],
    connections: buildDataConnections('获取 Dev.to 文章', ['格式化数据']),
    settings: { executionOrder: 'v1' },
  };
}

// ─── Product Hunt ─────────────────────────────────────────────────────────────

function buildProductHuntWorkflow(vars: TemplateVars): object {
  const { subscriptionId, frequency, backendUrl, webhookSecret, aiApiKey, productHuntApiKey, productHuntApiSecret } = vars;
  return {
    name: `FeedFlow - Product Hunt [${subscriptionId.slice(0, 8)}]`,
    nodes: [
      buildScheduleTrigger(frequency),
      buildWebhookTrigger(subscriptionId),
      {
        id: 'get_token',
        name: '获取 PH Token',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [320, 280],
        parameters: {
          method: 'POST',
          url: 'https://api.producthunt.com/v2/oauth/token',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify({
            client_id: productHuntApiKey ?? '',
            client_secret: productHuntApiSecret ?? '',
            grant_type: 'client_credentials',
          }),
          options: {},
        },
      },
      {
        id: 'fetch_ph',
        name: '获取 Product Hunt',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [520, 280],
        parameters: {
          method: 'POST',
          url: 'https://api.producthunt.com/v2/api/graphql',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'Authorization', value: '=Bearer {{ $json.access_token }}' },
              { name: 'Content-Type', value: 'application/json' },
            ],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify({
            query: `{ posts(first: 10, order: VOTES) { edges { node { name tagline url votesCount topics { edges { node { name } } } } } } }`,
          }),
          options: {},
        },
      },
      {
        id: 'format',
        name: '格式化数据',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [720, 280],
        parameters: {
          jsCode: `
const posts = $input.first().json.data.posts.edges.map((edge, index) => ({
  title: edge.node.name,
  url: edge.node.url,
  summary: edge.node.tagline,
  score: edge.node.votesCount,
  tags: edge.node.topics.edges.map(t => t.node.name),
  position: index + 1
}));
const aiPrompt = '以下是今日热门内容，请用中文为每条生成一句话摘要，并给出整体趋势总结。返回严格 JSON 格式：{ "summary": "整体摘要", "items": [{"title": "", "url": "", "summary": ""}] }\\n\\n' + JSON.stringify(posts);
return [{ json: { items: posts, aiPrompt } }];
          `.trim(),
        },
      },
      buildAiNode(aiApiKey, [920, 280]),
      buildParseAiNode([1120, 280]),
      buildCallbackNode(backendUrl, webhookSecret, subscriptionId, [1320, 280]),
    ],
    connections: buildDataConnections('获取 PH Token', ['获取 Product Hunt', '格式化数据']),
    settings: { executionOrder: 'v1' },
  };
}

// ─── 导出 ─────────────────────────────────────────────────────────────────────

export function buildWorkflow(source: FeedSource, vars: TemplateVars): object {
  switch (source) {
    case FeedSource.HACKER_NEWS:
      return buildHackerNewsWorkflow(vars);
    case FeedSource.GITHUB_TRENDING:
      return buildGithubTrendingWorkflow(vars);
    case FeedSource.DEVTO:
      return buildDevtoWorkflow(vars);
    case FeedSource.PRODUCT_HUNT:
      return buildProductHuntWorkflow(vars);
  }
}

export function getWebhookPath(subscriptionId: string): string {
  return `feedflow-${subscriptionId}`;
}
