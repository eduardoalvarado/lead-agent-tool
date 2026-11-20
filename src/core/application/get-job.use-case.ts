import { JobNotFoundError } from '../domain/errors/job-not-found.error.js';
import type { Job } from '../domain/job.js';
import type { JobRepository } from '../ports/job-repository.js';

export class GetJobUseCase {
  constructor(private readonly jobs: JobRepository) {}

  async execute(jobId: string): Promise<Job> {
    const job = await this.jobs.find(jobId);
    if (!job) throw new JobNotFoundError(`No existe el job ${jobId}.`);
    return job;
  }
}
