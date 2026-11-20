import type { Provider } from '@nestjs/common';
import { GetJobUseCase } from '../../core/application/get-job.use-case.js';
import { ListLeadsUseCase } from '../../core/application/list-leads.use-case.js';
import { SubmitSearchJobUseCase } from '../../core/application/submit-search-job.use-case.js';
import type { JobQueue } from '../../core/ports/job-queue.js';
import type { JobRepository } from '../../core/ports/job-repository.js';
import type { LeadRepository } from '../../core/ports/lead-repository.js';
import type { Clock } from '../../core/ports/system.js';
import { UuidGenerator } from '../../infrastructure/system/uuid-generator.js';
import {
  CLOCK,
  GET_JOB_USE_CASE,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LEAD_REPOSITORY,
  LIST_LEADS_USE_CASE,
  SUBMIT_SEARCH_JOB_USE_CASE,
} from './tokens.js';

// Casos de uso que no ejecutan el agente (TS puro), instanciados con sus puertos.
export const coreProviders: Provider[] = [
  {
    provide: SUBMIT_SEARCH_JOB_USE_CASE,
    inject: [JOB_REPOSITORY, JOB_QUEUE, CLOCK],
    useFactory: (jobs: JobRepository, queue: JobQueue, clock: Clock) =>
      new SubmitSearchJobUseCase(jobs, queue, new UuidGenerator(), clock),
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
