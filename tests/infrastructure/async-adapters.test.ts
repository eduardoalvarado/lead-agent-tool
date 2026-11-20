import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { PersistenceError } from '../../src/core/domain/errors/persistence.error.js';
import type { Job } from '../../src/core/domain/job.js';
import { DynamoJobRepository } from '../../src/infrastructure/persistence/dynamo-job-repository.js';
import { SqsJobQueue } from '../../src/infrastructure/queue/sqs-job-queue.js';
import { UnavailableJobQueue } from '../../src/infrastructure/queue/unavailable-job-queue.js';
import { FIXED_DATE } from '../support/fakes.js';

const job: Job = {
  jobId: 'job-1',
  criteria: { sector: 'Clínicas dentales', location: 'Lima' },
  status: 'pending',
  createdAt: FIXED_DATE.toISOString(),
  updatedAt: FIXED_DATE.toISOString(),
  summary: null,
  error: null,
};

function fakeDynamo(respond: (command: unknown) => unknown) {
  const sent: unknown[] = [];
  const client = {
    send: async (command: unknown) => {
      sent.push(command);
      return respond(command);
    },
  } as unknown as DynamoDBDocumentClient;
  return { client, sent };
}

describe('DynamoJobRepository', () => {
  it('crea, lee y valida jobs', async () => {
    const { client, sent } = fakeDynamo((command) =>
      command instanceof GetCommand ? { Item: job } : {},
    );
    const repository = new DynamoJobRepository(client, 'jobs');

    await repository.create(job);

    expect(sent[0]).toBeInstanceOf(PutCommand);
    expect(await repository.find('job-1')).toEqual(job);
  });

  it('devuelve null si el job no existe y rechaza ítems que no cumplen el schema', async () => {
    const missing = new DynamoJobRepository(fakeDynamo(() => ({})).client, 'jobs');
    const corrupt = new DynamoJobRepository(
      fakeDynamo(() => ({ Item: { jobId: 'x' } })).client,
      'jobs',
    );

    expect(await missing.find('nope')).toBeNull();
    await expect(corrupt.find('x')).rejects.toThrow(PersistenceError);
  });

  it('actualiza estado y campos con un UpdateExpression', async () => {
    const { client, sent } = fakeDynamo(() => ({}));

    await new DynamoJobRepository(client, 'jobs').fail('job-1', 'boom', FIXED_DATE);

    expect(sent[0]).toBeInstanceOf(UpdateCommand);
    expect((sent[0] as UpdateCommand).input).toMatchObject({
      Key: { jobId: 'job-1' },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #error = :error',
      ExpressionAttributeValues: { ':status': 'failed', ':error': 'boom' },
    });
  });

  it('traduce errores del SDK a PersistenceError', async () => {
    const { client } = fakeDynamo(() => {
      throw new Error('ResourceNotFoundException');
    });

    await expect(new DynamoJobRepository(client, 'jobs').create(job)).rejects.toThrow(
      PersistenceError,
    );
  });
});

describe('SqsJobQueue', () => {
  it('envía el mensaje del job como JSON a la cola', async () => {
    const sent: SendMessageCommand[] = [];
    const client = {
      send: async (command: SendMessageCommand) => {
        sent.push(command);
        return {};
      },
    } as unknown as SQSClient;

    await new SqsJobQueue(client, 'https://sqs/q').enqueue({
      jobId: 'job-1',
      criteria: job.criteria,
    });

    expect(sent[0]?.input).toEqual({
      QueueUrl: 'https://sqs/q',
      MessageBody: JSON.stringify({ jobId: 'job-1', criteria: job.criteria }),
    });
  });

  it('la cola nula del modo síncrono falla con un error de dominio', async () => {
    await expect(new UnavailableJobQueue().enqueue()).rejects.toThrow(PersistenceError);
  });
});
