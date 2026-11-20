// Smoke test del núcleo SIN NestJS: conecta a mano agente, tools y adaptadores para validar
// el tool calling contra el LLM real. Uso:
//   npm run smoke -- --sector "Clínicas dentales" --location "Lima, Perú"
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { LeadAgent } from '../src/core/agent/lead-agent.js';
import { DiscardLeadTool } from '../src/core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../src/core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../src/core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../src/core/agent/tools/search-web.tool.js';
import { SearchLeadsUseCase } from '../src/core/application/search-leads.use-case.js';
import type { LLMProvider } from '../src/core/ports/llm-provider.js';
import type { PageFetcher } from '../src/core/ports/page-fetcher.js';
import type { SearchProvider } from '../src/core/ports/search-provider.js';
import { HttpPageFetcher } from '../src/infrastructure/fetch/http-page-fetcher.js';
import { MockPageFetcher } from '../src/infrastructure/fetch/mock-page-fetcher.js';
import { BedrockProvider } from '../src/infrastructure/llm/bedrock-provider.js';
import { GroqProvider } from '../src/infrastructure/llm/groq-provider.js';
import { ConsoleLogger } from '../src/infrastructure/logging/console-logger.js';
import { InMemoryLeadRepository } from '../src/infrastructure/persistence/in-memory-lead-repository.js';
import { MockSearchProvider } from '../src/infrastructure/search/mock-search-provider.js';
import { TavilyProvider } from '../src/infrastructure/search/tavily-provider.js';
import { SystemClock } from '../src/infrastructure/system/system-clock.js';
import { UuidGenerator } from '../src/infrastructure/system/uuid-generator.js';

const EnvSchema = z
  .object({
    LLM_PROVIDER: z.enum(['groq', 'bedrock']).default('groq'),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
    AWS_REGION: z.string().default('us-east-2'),
    BEDROCK_MODEL: z.string().default('anthropic.claude-haiku-5-5'),
    BEDROCK_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    SEARCH_PROVIDER: z.enum(['tavily', 'mock']).default('mock'),
    TAVILY_API_KEY: z.string().optional(),
    AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(20),
    AGENT_MAX_LEADS: z.coerce.number().int().positive().default(10),
  })
  .refine((env) => env.LLM_PROVIDER !== 'groq' || Boolean(env.GROQ_API_KEY), {
    message: 'GROQ_API_KEY es obligatoria con LLM_PROVIDER=groq',
  })
  .refine((env) => env.SEARCH_PROVIDER === 'mock' || Boolean(env.TAVILY_API_KEY), {
    message: 'TAVILY_API_KEY es obligatoria con SEARCH_PROVIDER=tavily',
  });

const HTTP_TIMEOUT_MS = 10_000;
const LLM_MAX_RETRIES = 2;
const BEDROCK_MAX_TOKENS = 16_000;
const USER_AGENT = 'LeadAgentPoC/0.1';

const env = EnvSchema.parse(process.env);
const { values } = parseArgs({
  options: {
    sector: { type: 'string', default: 'Agencias de marketing' },
    location: { type: 'string', default: 'Lima, Perú' },
  },
});

const isGroq = env.LLM_PROVIDER === 'groq';
const llm: LLMProvider = isGroq
  ? new GroqProvider({
      apiKey: env.GROQ_API_KEY ?? '',
      model: env.GROQ_MODEL,
      timeoutMs: env.LLM_TIMEOUT_MS,
      maxRetries: LLM_MAX_RETRIES,
    })
  : new BedrockProvider({
      region: env.AWS_REGION,
      model: env.BEDROCK_MODEL,
      effort: env.BEDROCK_EFFORT,
      maxTokens: BEDROCK_MAX_TOKENS,
      timeoutMs: env.LLM_TIMEOUT_MS,
      maxRetries: LLM_MAX_RETRIES,
    });

const useMock = env.SEARCH_PROVIDER === 'mock';
const searchProvider: SearchProvider = useMock
  ? new MockSearchProvider()
  : new TavilyProvider({ apiKey: env.TAVILY_API_KEY ?? '', timeoutMs: HTTP_TIMEOUT_MS });
const pageFetcher: PageFetcher = useMock
  ? new MockPageFetcher()
  : new HttpPageFetcher({ timeoutMs: HTTP_TIMEOUT_MS, userAgent: USER_AGENT });

const repository = new InMemoryLeadRepository();
const agent = new LeadAgent(
  llm,
  [
    new SearchWebTool(searchProvider),
    new FetchPageTool(pageFetcher),
    new SaveLeadTool(repository, new SystemClock()),
    new DiscardLeadTool(),
  ],
  new ConsoleLogger(),
  {
    maxIterations: env.AGENT_MAX_ITERATIONS,
    maxLeads: env.AGENT_MAX_LEADS,
    // Groq free tier: 8k tokens/min. Claude exige el historial intacto (thinking preservado).
    compactObservations: isGroq,
  },
);

const summary = await new SearchLeadsUseCase(agent, new UuidGenerator()).execute({
  sector: values.sector,
  location: values.location,
});
process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
