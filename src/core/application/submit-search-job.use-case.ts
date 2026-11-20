import { z } from 'zod';
import { InvalidSearchCriteriaError } from '../domain/errors/invalid-search-criteria.error.js';
import type { Job } from '../domain/job.js';
import { SearchCriteriaSchema } from '../domain/search-criteria.js';
import type { JobQueue } from '../ports/job-queue.js';
import type { JobRepository } from '../ports/job-repository.js';
import type { Clock, IdGenerator } from '../ports/system.js';

/** Flujo asíncrono: registra el job, lo encola y devuelve el control de inmediato (202). */
export class SubmitSearchJobUseCase {
  constructor(
    private readonly jobs: JobRepository,
    private readonly queue: JobQueue,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: { sector: string; location: string }): Promise<Job> {
    const parsed = SearchCriteriaSchema.safeParse(input);
    if (!parsed.success) throw new InvalidSearchCriteriaError(z.prettifyError(parsed.error));

    const now = this.clock.now().toISOString();
    const job: Job = {
      jobId: this.ids.generate(),
      criteria: parsed.data,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      summary: null,
      error: null,
    };
    // Primero el registro y luego la cola: el worker nunca recibe un job inexistente.
    await this.jobs.create(job);
    await this.queue.enqueue({ jobId: job.jobId, criteria: job.criteria });
    return job;
  }
}
