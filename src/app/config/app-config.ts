import { z } from 'zod';

export const LLM_PROVIDERS = ['groq', 'ollama', 'openai-compatible', 'bedrock'] as const;

const REQUIRES_API_KEY: ReadonlySet<string> = new Set(['groq', 'openai-compatible']);

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/** Variables de entorno de la aplicación, validadas al arrancar (falla rápido si falta algo). */
export const AppConfigSchema = z
  .object({
    PORT: positiveInt(3000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('groq'),
    LLM_TIMEOUT_MS: positiveInt(60_000),
    LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
    // Proveedores compatibles con OpenAI (groq, ollama, openai-compatible).
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().min(1).optional(),
    LLM_BASE_URL: z.url().optional(),
    // Esfuerzo de razonamiento (modelos que lo admiten, p. ej. gpt-oss): menos esfuerzo = menos tokens.
    LLM_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).optional(),
    // Temperatura: algunos modelos (p. ej. Claude actuales) rechazan el parámetro; si no se define
    // y el preset no la fija, no se envía.
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).optional(),
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
  .refine((env) => !REQUIRES_API_KEY.has(env.LLM_PROVIDER) || Boolean(env.LLM_API_KEY), {
    message: 'LLM_API_KEY es obligatoria con LLM_PROVIDER=groq u openai-compatible',
    path: ['LLM_API_KEY'],
  })
  .refine(
    (env) => env.LLM_PROVIDER !== 'openai-compatible' || Boolean(env.LLM_BASE_URL && env.LLM_MODEL),
    {
      message: 'LLM_BASE_URL y LLM_MODEL son obligatorias con LLM_PROVIDER=openai-compatible',
      path: ['LLM_BASE_URL'],
    },
  )
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
