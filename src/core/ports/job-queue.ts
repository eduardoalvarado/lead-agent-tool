import type { JobMessage } from '../domain/job.js';

/** Cola de trabajos (SQS en AWS): desacopla la API, que responde al instante, del worker. */
export interface JobQueue {
  enqueue(message: JobMessage): Promise<void>;
}
