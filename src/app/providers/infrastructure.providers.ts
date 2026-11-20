import { SQSClient } from '@aws-sdk/client-sqs';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Provider } from '@nestjs/common';
import type { JobQueue } from '../../core/ports/job-queue.js';
import type { JobRepository } from '../../core/ports/job-repository.js';
import type { Clock } from '../../core/ports/system.js';
import { DynamoJobRepository } from '../../infrastructure/persistence/dynamo-job-repository.js';
import { SqsJobQueue } from '../../infrastructure/queue/sqs-job-queue.js';
import { UnavailableJobQueue } from '../../infrastructure/queue/unavailable-job-queue.js';
import { SystemClock } from '../../infrastructure/system/system-clock.js';
import type { LeadRepository } from '../../core/ports/lead-repository.js';
import type { Logger } from '../../core/ports/logger.js';
import type { LLMProvider } from '../../core/ports/llm-provider.js';
import type { PageFetcher } from '../../core/ports/page-fetcher.js';
import type { SearchProvider } from '../../core/ports/search-provider.js';
import { HttpPageFetcher } from '../../infrastructure/fetch/http-page-fetcher.js';
import { MockPageFetcher } from '../../infrastructure/fetch/mock-page-fetcher.js';
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { createDynamoDocumentClient } from '../../infrastructure/persistence/dynamo-client.factory.js';
import { DynamoLeadRepository } from '../../infrastructure/persistence/dynamo-lead-repository.js';
import { MockSearchProvider } from '../../infrastructure/search/mock-search-provider.js';
import { TavilyProvider } from '../../infrastructure/search/tavily-provider.js';
import type { AppConfig } from '../config/app-config.js';
import { LLM_ADAPTERS } from './llm-registry.js';
import {
  APP_CONFIG,
  CLOCK,
  DYNAMO_CLIENT,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LEAD_REPOSITORY,
  LLM_PROVIDER,
  LOGGER,
  PAGE_FETCHER,
  SEARCH_PROVIDER,
} from './tokens.js';

const USER_AGENT = 'LeadAgentPoC/0.1';

// Adaptadores (infraestructura) elegidos según la configuración.
export const infrastructureProviders: Provider[] = [
  {
    provide: LOGGER,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): Logger => new ConsoleLogger(config.LOG_LEVEL),
  },
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
    provide: DYNAMO_CLIENT,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): DynamoDBDocumentClient =>
      createDynamoDocumentClient({ region: config.AWS_REGION, endpoint: config.DYNAMO_ENDPOINT }),
  },
  {
    provide: LEAD_REPOSITORY,
    inject: [APP_CONFIG, DYNAMO_CLIENT],
    useFactory: (config: AppConfig, client: DynamoDBDocumentClient): LeadRepository =>
      new DynamoLeadRepository(client, config.DYNAMO_TABLE),
  },
  {
    provide: JOB_REPOSITORY,
    inject: [APP_CONFIG, DYNAMO_CLIENT],
    useFactory: (config: AppConfig, client: DynamoDBDocumentClient): JobRepository =>
      new DynamoJobRepository(client, config.JOBS_TABLE),
  },
  {
    provide: JOB_QUEUE,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): JobQueue =>
      config.JOBS_QUEUE_URL
        ? new SqsJobQueue(new SQSClient({ region: config.AWS_REGION }), config.JOBS_QUEUE_URL)
        : new UnavailableJobQueue(),
  },
  { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
];
