import 'dotenv/config';

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 8787),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  llm: {
    url: process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    key: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    jsonMode: process.env.LLM_DISABLE_JSON_MODE !== 'true',
    timeoutMs: int(process.env.LLM_TIMEOUT_MS, 60000),
  },
  dailyPointCap: int(process.env.DAILY_POINT_CAP, 30),
};

export function describeConfig() {
  return {
    database: Boolean(config.supabaseUrl && config.supabaseServiceKey),
    llm: Boolean(config.llm.key),
    model: config.llm.model,
  };
}
