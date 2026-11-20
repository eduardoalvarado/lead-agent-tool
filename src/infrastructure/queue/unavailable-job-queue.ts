import { PersistenceError } from '../../core/domain/errors/persistence.error.js';
import type { JobQueue } from '../../core/ports/job-queue.js';

/** Cola nula para el modo síncrono (local): ningún flujo debería encolar en ese modo. */
export class UnavailableJobQueue implements JobQueue {
  async enqueue(): Promise<void> {
    throw new PersistenceError('La cola de jobs no está configurada (EXECUTION_MODE=sync).');
  }
}
