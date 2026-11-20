// Composición del agente SIN NestJS para scripts de desarrollo (smoke test y evaluación):
// misma configuración y mismo registro de LLMs que la app, repositorio en memoria.
import type { AppConfig } from '../../src/app/config/app-config.js';
import { LLM_ADAPTERS } from '../../src/app/providers/llm-registry.js';
import { LeadAgent } from '../../src/core/agent/lead-agent.js';
import { DiscardLeadTool } from '../../src/core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../../src/core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../../src/core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../src/core/agent/tools/search-web.tool.js';
import type { LeadRepository } from '../../src/core/ports/lead-repository.js';
import { HttpPageFetcher } from '../../src/infrastructure/fetch/http-page-fetcher.js';
import { MockPageFetcher } from '../../src/infrastructure/fetch/mock-page-fetcher.js';
import { ConsoleLogger } from '../../src/infrastructure/logging/console-logger.js';
import { MockSearchProvider } from '../../src/infrastructure/search/mock-search-provider.js';
import { TavilyProvider } from '../../src/infrastructure/search/tavily-provider.js';
import { SystemClock } from '../../src/infrastructure/system/system-clock.js';

const USER_AGENT = 'LeadAgentPoC/0.1';

export function composeAgent(config: AppConfig, repository: LeadRepository): LeadAgent {
  const useMock = config.SEARCH_PROVIDER === 'mock';
  const llm = LLM_ADAPTERS[config.LLM_PROVIDER];
  const search = useMock
    ? new MockSearchProvider()
    : new TavilyProvider({
        apiKey: config.TAVILY_API_KEY ?? '',
        timeoutMs: config.HTTP_TIMEOUT_MS,
      });
  const fetcher = useMock
    ? new MockPageFetcher()
    : new HttpPageFetcher({ timeoutMs: config.HTTP_TIMEOUT_MS, userAgent: USER_AGENT });

  return new LeadAgent(
    llm.create(config),
    [
      new SearchWebTool(search),
      new FetchPageTool(fetcher),
      new SaveLeadTool(repository, new SystemClock()),
      new DiscardLeadTool(),
    ],
    new ConsoleLogger(config.LOG_LEVEL),
    {
      maxIterations: config.AGENT_MAX_ITERATIONS,
      maxLeads: config.AGENT_MAX_LEADS,
      compactObservations: llm.compactObservations,
    },
  );
}
