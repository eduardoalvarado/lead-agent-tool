import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { PersistenceError } from '../../core/domain/errors/persistence.error.js';
import { type Job, type JobStatus, JobSchema } from '../../core/domain/job.js';
import type { AgentRunSummary } from '../../core/domain/run-summary.js';
import type { JobRepository } from '../../core/ports/job-repository.js';
import { describeError } from '../shared/describe-error.js';

export class DynamoJobRepository implements JobRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(job: Job): Promise<void> {
    await this.send(`crear el job ${job.jobId}`, () =>
      this.client.send(new PutCommand({ TableName: this.tableName, Item: job })),
    );
  }

  async find(jobId: string): Promise<Job | null> {
    const result = await this.send(`leer el job ${jobId}`, () =>
      this.client.send(new GetCommand({ TableName: this.tableName, Key: { jobId } })),
    );
    if (!result.Item) return null;
    const parsed = JobSchema.safeParse(result.Item);
    if (!parsed.success) throw new PersistenceError(`El job ${jobId} no cumple el schema.`);
    return parsed.data;
  }

  async markRunning(jobId: string, at: Date): Promise<void> {
    await this.update(jobId, 'running', at, {});
  }

  async complete(jobId: string, summary: AgentRunSummary, at: Date): Promise<void> {
    await this.update(jobId, 'completed', at, { summary });
  }

  async fail(jobId: string, error: string, at: Date): Promise<void> {
    await this.update(jobId, 'failed', at, { error });
  }

  private async update(
    jobId: string,
    status: JobStatus,
    at: Date,
    fields: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const values = { status, updatedAt: at.toISOString(), ...fields };
    const names = Object.keys(values);
    await this.send(`actualizar el job ${jobId}`, () =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { jobId },
          UpdateExpression: `SET ${names.map((name) => `#${name} = :${name}`).join(', ')}`,
          ExpressionAttributeNames: Object.fromEntries(names.map((name) => [`#${name}`, name])),
          ExpressionAttributeValues: Object.fromEntries(
            Object.entries(values).map(([name, value]) => [`:${name}`, value]),
          ),
        }),
      ),
    );
  }

  private async send<T>(action: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new PersistenceError(`DynamoDB: no se pudo ${action}: ${describeError(error)}`, {
        cause: error,
      });
    }
  }
}
