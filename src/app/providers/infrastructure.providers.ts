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
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { createDynamoDocumentClient } from '../../infrastructure/persistence/dynamo-client.factory.js';
import { DynamoLeadRepository } from '../../infrastructure/persistence/dynamo-lead-repository.js';
import type { AppConfig } from '../config/app-config.js';
import {
  APP_CONFIG,
  CLOCK,
  DYNAMO_CLIENT,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LEAD_REPOSITORY,
  LOGGER,
} from './tokens.js';

// Adaptadores comunes a todos los procesos (persistencia, cola, log y reloj).
export const infrastructureProviders: Provider[] = [
  {
    provide: LOGGER,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): Logger => new ConsoleLogger(config.LOG_LEVEL),
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
