import type { LeadAgent } from '../agent/lead-agent.js';
import { DomainError } from '../domain/errors/domain-error.js';
import type { JobMessage } from '../domain/job.js';
import type { JobRepository } from '../ports/job-repository.js';
import type { Logger } from '../ports/logger.js';
import type { Clock } from '../ports/system.js';

export type JobProcessingResult = 'completed' | 'failed' | 'skipped';

/**
 * Worker del flujo asíncrono: ejecuta el agente para un job encolado y guarda el resultado.
 * Los errores de dominio (servicios externos) marcan el job como fallido sin reintentar; los
 * inesperados se propagan para que la cola reintente y, tras varios intentos, vaya a la DLQ.
 */
export class ProcessSearchJobUseCase {
  constructor(
    private readonly agent: LeadAgent,
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute({ jobId, criteria }: JobMessage): Promise<JobProcessingResult> {
    const job = await this.jobs.find(jobId);
    // Idempotencia ante reentregas de la cola: un job ya resuelto no se vuelve a ejecutar.
    if (job && (job.status === 'completed' || job.status === 'failed')) {
      this.logger.warn('Job ya resuelto; se omite la reentrega', { jobId, status: job.status });
      return 'skipped';
    }

    await this.jobs.markRunning(jobId, this.clock.now());
    try {
      const summary = await this.agent.run(criteria, jobId);
      await this.jobs.complete(jobId, summary, this.clock.now());
      return 'completed';
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      await this.jobs.fail(jobId, error.message, this.clock.now());
      return 'failed';
    }
  }
}
