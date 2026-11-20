import { z } from 'zod';

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/** Variables de entorno de la aplicación, validadas al arrancar (falla rápido si falta algo). */
export const AppConfigSchema = z
  .object({
    PORT: positiveInt(3000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    LLM_PROVIDER: z.enum(['groq', 'bedrock']).default('groq'),
    LLM_TIMEOUT_MS: positiveInt(60_000),
    LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
    AWS_REGION: z.string().min(1).default('us-east-2'),
    BEDROCK_MODEL: z.string().min(1).default('anthropic.claude-haiku-5-5'),
    BEDROCK_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    BEDROCK_MAX_TOKENS: positiveInt(16_000),

    SEARCH_PROVIDER: z.enum(['tavily', 'mock']).default('mock'),
    TAVILY_API_KEY: z.string().optional(),
    HTTP_TIMEOUT_MS: positiveInt(10_000),

    DYNAMO_ENDPOINT: z.string().optional(),
    DYNAMO_TABLE: z.string().min(1).default('leads'),

    AGENT_MAX_ITERATIONS: positiveInt(20),
    AGENT_MAX_LEADS: positiveInt(10),
  })
  .refine((env) => env.LLM_PROVIDER !== 'groq' || Boolean(env.GROQ_API_KEY), {
    message: 'GROQ_API_KEY es obligatoria con LLM_PROVIDER=groq',
    path: ['GROQ_API_KEY'],
  })
  .refine((env) => env.SEARCH_PROVIDER !== 'tavily' || Boolean(env.TAVILY_API_KEY), {
    message: 'TAVILY_API_KEY es obligatoria con SEARCH_PROVIDER=tavily',
    path: ['TAVILY_API_KEY'],
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Valida el entorno; las variables vacías (`KEY=`) se tratan como ausentes. */
export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const parsed = AppConfigSchema.safeParse(defined);
  if (!parsed.success) {
    throw new Error(`Configuración inválida:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Carga `.env` si existe (desarrollo local). En Lambda las variables vienen del entorno. */
export function loadDotEnvIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    // Sin archivo .env: se usan solo las variables del entorno.
  }
}
