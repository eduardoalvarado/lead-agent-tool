import type { Provider } from '@nestjs/common';
import { LeadAgent } from '../../core/agent/lead-agent.js';
import { DiscardLeadTool } from '../../core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../../core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../../core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../core/agent/tools/search-web.tool.js';
import { GetJobUseCase } from '../../core/application/get-job.use-case.js';
import { ListLeadsUseCase } from '../../core/application/list-leads.use-case.js';
import { ProcessSearchJobUseCase } from '../../core/application/process-search-job.use-case.js';
import { SearchLeadsUseCase } from '../../core/application/search-leads.use-case.js';
import { SubmitSearchJobUseCase } from '../../core/application/submit-search-job.use-case.js';
import type { JobQueue } from '../../core/ports/job-queue.js';
import type { JobRepository } from '../../core/ports/job-repository.js';
import type { LeadRepository } from '../../core/ports/lead-repository.js';
import type { LLMProvider } from '../../core/ports/llm-provider.js';
import type { Logger } from '../../core/ports/logger.js';
import type { PageFetcher } from '../../core/ports/page-fetcher.js';
import type { SearchProvider } from '../../core/ports/search-provider.js';
import type { Clock } from '../../core/ports/system.js';
import { SystemClock } from '../../infrastructure/system/system-clock.js';
import { UuidGenerator } from '../../infrastructure/system/uuid-generator.js';
import type { AppConfig } from '../config/app-config.js';
import { LLM_ADAPTERS } from './llm-registry.js';
import {
  APP_CONFIG,
  CLOCK,
  GET_JOB_USE_CASE,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LEAD_AGENT,
  LEAD_REPOSITORY,
  LIST_LEADS_USE_CASE,
  LLM_PROVIDER,
  LOGGER,
  PAGE_FETCHER,
  PROCESS_SEARCH_JOB_USE_CASE,
  SEARCH_LEADS_USE_CASE,
  SEARCH_PROVIDER,
  SUBMIT_SEARCH_JOB_USE_CASE,
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
    provide: SUBMIT_SEARCH_JOB_USE_CASE,
    inject: [JOB_REPOSITORY, JOB_QUEUE, CLOCK],
    useFactory: (jobs: JobRepository, queue: JobQueue, clock: Clock) =>
      new SubmitSearchJobUseCase(jobs, queue, new UuidGenerator(), clock),
  },
  {
    provide: PROCESS_SEARCH_JOB_USE_CASE,
    inject: [LEAD_AGENT, JOB_REPOSITORY, CLOCK, LOGGER],
    useFactory: (agent: LeadAgent, jobs: JobRepository, clock: Clock, logger: Logger) =>
      new ProcessSearchJobUseCase(agent, jobs, clock, logger),
  },
  {
    provide: GET_JOB_USE_CASE,
    inject: [JOB_REPOSITORY],
    useFactory: (jobs: JobRepository) => new GetJobUseCase(jobs),
  },
  {
    provide: LIST_LEADS_USE_CASE,
    inject: [LEAD_REPOSITORY],
    useFactory: (repository: LeadRepository) => new ListLeadsUseCase(repository),
  },
];
