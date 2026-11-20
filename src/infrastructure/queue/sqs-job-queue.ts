import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { PersistenceError } from '../../core/domain/errors/persistence.error.js';
import type { JobMessage } from '../../core/domain/job.js';
import type { JobQueue } from '../../core/ports/job-queue.js';
import { describeError } from '../shared/describe-error.js';

export class SqsJobQueue implements JobQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(message: JobMessage): Promise<void> {
    try {
      await this.client.send(
        new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(message) }),
      );
    } catch (error) {
      throw new PersistenceError(
        `SQS: no se pudo encolar el job ${message.jobId}: ${describeError(error)}`,
        {
          cause: error,
        },
      );
    }
  }
}
