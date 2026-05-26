export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'feedflow',
    password: process.env.DB_PASSWORD ?? 'feedflow_password',
    database: process.env.DB_DATABASE ?? 'feedflow_db',
  },
  n8n: {
    baseUrl: process.env.N8N_BASE_URL ?? 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY ?? '',
    webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  },
  backendUrl: process.env.BACKEND_URL ?? 'http://host.docker.internal:3000',
});
