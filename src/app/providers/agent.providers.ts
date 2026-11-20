import type { Provider } from '@nestjs/common';
import { LeadAgent } from '../../core/agent/lead-agent.js';
import { DiscardLeadTool } from '../../core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../../core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../../core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../core/agent/tools/search-web.tool.js';
import { ProcessSearchJobUseCase } from '../../core/application/process-search-job.use-case.js';
import { SearchLeadsUseCase } from '../../core/application/search-leads.use-case.js';
import type { JobRepository } from '../../core/ports/job-repository.js';
import type { LeadRepository } from '../../core/ports/lead-repository.js';
import type { LLMProvider } from '../../core/ports/llm-provider.js';
import type { Logger } from '../../core/ports/logger.js';
import type { PageFetcher } from '../../core/ports/page-fetcher.js';
import type { SearchProvider } from '../../core/ports/search-provider.js';
import type { Clock } from '../../core/ports/system.js';
import { HttpPageFetcher } from '../../infrastructure/fetch/http-page-fetcher.js';
import { MockPageFetcher } from '../../infrastructure/fetch/mock-page-fetcher.js';
import { MockSearchProvider } from '../../infrastructure/search/mock-search-provider.js';
import { TavilyProvider } from '../../infrastructure/search/tavily-provider.js';
import { SystemClock } from '../../infrastructure/system/system-clock.js';
import { UuidGenerator } from '../../infrastructure/system/uuid-generator.js';
import type { AppConfig } from '../config/app-config.js';
import { LLM_ADAPTERS } from './llm-registry.js';
import {
  APP_CONFIG,
  CLOCK,
  JOB_REPOSITORY,
  LEAD_AGENT,
  LEAD_REPOSITORY,
  LLM_PROVIDER,
  LOGGER,
  PAGE_FETCHER,
  PROCESS_SEARCH_JOB_USE_CASE,
  SEARCH_LEADS_USE_CASE,
  SEARCH_PROVIDER,
} from './tokens.js';

const USER_AGENT = 'LeadAgentPoC/0.1';

// El agente con sus adaptadores (LLM, búsqueda, lectura de páginas) y los casos de uso que lo
// ejecutan. Son los únicos que necesitan las credenciales de terceros.
export const agentProviders: Provider[] = [
  {
    provide: LLM_PROVIDER,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): LLMProvider =>
      LLM_ADAPTERS[config.LLM_PROVIDER].create(config),
  },
  {
    provide: SEARCH_PROVIDER,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): SearchProvider =>
      config.SEARCH_PROVIDER === 'mock'
        ? new MockSearchProvider()
        : new TavilyProvider({
            apiKey: config.TAVILY_API_KEY ?? '',
            timeoutMs: config.HTTP_TIMEOUT_MS,
          }),
  },
  {
    provide: PAGE_FETCHER,
    inject: [APP_CONFIG],
    // En modo mock tampoco se hacen peticiones de red al leer páginas.
    useFactory: (config: AppConfig): PageFetcher =>
      config.SEARCH_PROVIDER === 'mock'
        ? new MockPageFetcher()
        : new HttpPageFetcher({ timeoutMs: config.HTTP_TIMEOUT_MS, userAgent: USER_AGENT }),
  },
  {
    provide: LEAD_AGENT,
    inject: [APP_CONFIG, LLM_PROVIDER, SEARCH_PROVIDER, PAGE_FETCHER, LEAD_REPOSITORY, LOGGER],
    useFactory: (
      config: AppConfig,
      llm: LLMProvider,
      search: SearchProvider,
      fetcher: PageFetcher,
      repository: LeadRepository,
      logger: Logger,
    ) =>
      new LeadAgent(
        llm,
        [
          new SearchWebTool(search),
          new FetchPageTool(fetcher),
          new SaveLeadTool(repository, new SystemClock()),
          new DiscardLeadTool(),
        ],
        logger,
        {
          maxIterations: config.AGENT_MAX_ITERATIONS,
          maxLeads: config.AGENT_MAX_LEADS,
          compactObservations: LLM_ADAPTERS[config.LLM_PROVIDER].compactObservations,
        },
      ),
  },
  {
    provide: SEARCH_LEADS_USE_CASE,
    inject: [LEAD_AGENT],
    useFactory: (agent: LeadAgent) => new SearchLeadsUseCase(agent, new UuidGenerator()),
  },
  {
    provide: PROCESS_SEARCH_JOB_USE_CASE,
    inject: [LEAD_AGENT, JOB_REPOSITORY, CLOCK, LOGGER],
    useFactory: (agent: LeadAgent, jobs: JobRepository, clock: Clock, logger: Logger) =>
      new ProcessSearchJobUseCase(agent, jobs, clock, logger),
  },
];
