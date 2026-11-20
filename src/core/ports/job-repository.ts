import type { Job } from '../domain/job.js';
import type { AgentRunSummary } from '../domain/run-summary.js';

export interface JobRepository {
  create(job: Job): Promise<void>;
  find(jobId: string): Promise<Job | null>;
  markRunning(jobId: string, at: Date): Promise<void>;
  complete(jobId: string, summary: AgentRunSummary, at: Date): Promise<void>;
  fail(jobId: string, error: string, at: Date): Promise<void>;
}
