import type { Provider } from '@nestjs/common';
import { LeadAgent } from '../../core/agent/lead-agent.js';
import { DiscardLeadTool } from '../../core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../../core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../../core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../core/agent/tools/search-web.tool.js';
import { ListLeadsUseCase } from '../../core/application/list-leads.use-case.js';
import { SearchLeadsUseCase } from '../../core/application/search-leads.use-case.js';
import type { LeadRepository } from '../../core/ports/lead-repository.js';
import type { LLMProvider } from '../../core/ports/llm-provider.js';
import type { Logger } from '../../core/ports/logger.js';
import type { PageFetcher } from '../../core/ports/page-fetcher.js';
import type { SearchProvider } from '../../core/ports/search-provider.js';
import { SystemClock } from '../../infrastructure/system/system-clock.js';
import { UuidGenerator } from '../../infrastructure/system/uuid-generator.js';
import type { AppConfig } from '../config/app-config.js';
import { LLM_ADAPTERS } from './llm-registry.js';
import {
  APP_CONFIG,
  LEAD_AGENT,
  LEAD_REPOSITORY,
  LIST_LEADS_USE_CASE,
  LLM_PROVIDER,
  LOGGER,
  PAGE_FETCHER,
  SEARCH_LEADS_USE_CASE,
  SEARCH_PROVIDER,
} from './tokens.js';

// Clases del núcleo (TS puro) instanciadas con sus puertos: aquí y solo aquí se conectan.
export const coreProviders: Provider[] = [
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
    provide: LIST_LEADS_USE_CASE,
    inject: [LEAD_REPOSITORY],
    useFactory: (repository: LeadRepository) => new ListLeadsUseCase(repository),
  },
];
