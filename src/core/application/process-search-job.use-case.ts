import type { LeadAgent } from '../agent/lead-agent.js';
import { DomainError } from '../domain/errors/domain-error.js';
import type { JobMessage } from '../domain/job.js';
import type { JobRepository } from '../ports/job-repository.js';
import type { Logger } from '../ports/logger.js';
import type { Clock } from '../ports/system.js';

export type JobProcessingResult = 'completed' | 'failed' | 'skipped';

/** Contexto de la entrega del mensaje, que conoce quien consume la cola. */
export interface JobAttempt {
  /** No quedan reintentos: si este intento falla, el mensaje va a la DLQ. */
  readonly finalAttempt: boolean;
  /** Plazo de la ejecución; al vencer, el agente corta con lo avanzado (`time_limit`). */
  readonly deadline?: AbortSignal;
}

// Sin contexto de la cola se asume que no hay reintentos: así un fallo nunca deja el job en
// `running` para siempre.
const SINGLE_ATTEMPT: JobAttempt = { finalAttempt: true };

const FINAL_ATTEMPT_ERROR =
  'Error inesperado tras agotar los reintentos; el detalle está en los logs del worker.';

/**
 * Worker del flujo asíncrono: ejecuta el agente para un job encolado y guarda el resultado.
 * Los errores de dominio (servicios externos) marcan el job como fallido sin reintentar; los
 * inesperados se propagan para que la cola reintente. En el último intento, además, el job se
 * marca como fallido antes de que el mensaje pase a la DLQ.
 */
export class ProcessSearchJobUseCase {
  constructor(
    private readonly agent: LeadAgent,
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute(
    { jobId, criteria }: JobMessage,
    attempt: JobAttempt = SINGLE_ATTEMPT,
  ): Promise<JobProcessingResult> {
    const job = await this.jobs.find(jobId);
    // Idempotencia ante reentregas de la cola: un job ya resuelto no se vuelve a ejecutar.
    if (job && (job.status === 'completed' || job.status === 'failed')) {
      this.logger.warn('Job ya resuelto; se omite la reentrega', { jobId, status: job.status });
      return 'skipped';
    }

    await this.jobs.markRunning(jobId, this.clock.now());
    try {
      const summary = await this.agent.run(criteria, jobId, attempt.deadline);
      await this.jobs.complete(jobId, summary, this.clock.now());
      return 'completed';
    } catch (error) {
      if (error instanceof DomainError) {
        await this.jobs.fail(jobId, error.message, this.clock.now());
        return 'failed';
      }
      if (attempt.finalAttempt) await this.failFinalAttempt(jobId, error);
      throw error;
    }
  }

  /** El detalle del error inesperado va al log, no al job, que es visible para el cliente. */
  private async failFinalAttempt(jobId: string, error: unknown): Promise<void> {
    this.logger.error('Último intento fallido: el job se marca failed y el mensaje va a la DLQ', {
      jobId,
      reason: error instanceof Error ? error.message : String(error),
    });
    await this.jobs.fail(jobId, FINAL_ATTEMPT_ERROR, this.clock.now());
  }
}
