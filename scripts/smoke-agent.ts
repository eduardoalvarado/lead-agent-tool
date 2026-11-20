// Smoke test del núcleo SIN NestJS: conecta a mano agente, tools y adaptadores (con la misma
// configuración y el mismo registro de LLMs que la app) y usa un repositorio en memoria.
// Uso: npm run smoke -- --sector "Clínicas dentales" --location "Lima, Perú"
import { parseArgs } from 'node:util';
import { loadAppConfig } from '../src/app/config/app-config.js';
import { LLM_ADAPTERS } from '../src/app/providers/llm-registry.js';
import { LeadAgent } from '../src/core/agent/lead-agent.js';
import { DiscardLeadTool } from '../src/core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../src/core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../src/core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../src/core/agent/tools/search-web.tool.js';
import { SearchLeadsUseCase } from '../src/core/application/search-leads.use-case.js';
import { HttpPageFetcher } from '../src/infrastructure/fetch/http-page-fetcher.js';
import { MockPageFetcher } from '../src/infrastructure/fetch/mock-page-fetcher.js';
import { ConsoleLogger } from '../src/infrastructure/logging/console-logger.js';
import { InMemoryLeadRepository } from '../src/infrastructure/persistence/in-memory-lead-repository.js';
import { MockSearchProvider } from '../src/infrastructure/search/mock-search-provider.js';
import { TavilyProvider } from '../src/infrastructure/search/tavily-provider.js';
import { SystemClock } from '../src/infrastructure/system/system-clock.js';
import { UuidGenerator } from '../src/infrastructure/system/uuid-generator.js';

const USER_AGENT = 'LeadAgentPoC/0.1';

const config = loadAppConfig(process.env);
const { values } = parseArgs({
  options: {
    sector: { type: 'string', default: 'Agencias de marketing' },
    location: { type: 'string', default: 'Lima, Perú' },
  },
});

const useMock = config.SEARCH_PROVIDER === 'mock';
const llm = LLM_ADAPTERS[config.LLM_PROVIDER];
const agent = new LeadAgent(
  llm.create(config),
  [
    new SearchWebTool(
      useMock
        ? new MockSearchProvider()
        : new TavilyProvider({
            apiKey: config.TAVILY_API_KEY ?? '',
            timeoutMs: config.HTTP_TIMEOUT_MS,
          }),
    ),
    new FetchPageTool(
      useMock
        ? new MockPageFetcher()
        : new HttpPageFetcher({ timeoutMs: config.HTTP_TIMEOUT_MS, userAgent: USER_AGENT }),
    ),
    new SaveLeadTool(new InMemoryLeadRepository(), new SystemClock()),
    new DiscardLeadTool(),
  ],
  new ConsoleLogger(config.LOG_LEVEL),
  {
    maxIterations: config.AGENT_MAX_ITERATIONS,
    maxLeads: config.AGENT_MAX_LEADS,
    compactObservations: llm.compactObservations,
  },
);

const summary = await new SearchLeadsUseCase(agent, new UuidGenerator()).execute({
  sector: values.sector,
  location: values.location,
});
process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
