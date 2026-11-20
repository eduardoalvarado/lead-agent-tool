// Crea la tabla de leads si no existe (idempotente). Uso: npm run db:init
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { z } from 'zod';
import { createDynamoDocumentClient } from '../src/infrastructure/persistence/dynamo-client.factory.js';
import { jobsTableDefinition } from '../src/infrastructure/persistence/jobs-table.js';
import { leadsTableDefinition } from '../src/infrastructure/persistence/leads-table.js';

const EnvSchema = z.object({
  AWS_REGION: z.string().default('us-east-2'),
  DYNAMO_ENDPOINT: z.string().optional(),
  DYNAMO_TABLE: z.string().min(1).default('leads'),
  JOBS_TABLE: z.string().min(1).default('jobs'),
});

const TABLE_READY_TIMEOUT_S = 30;

const env = EnvSchema.parse(process.env);
const client = createDynamoDocumentClient({
  region: env.AWS_REGION,
  endpoint: env.DYNAMO_ENDPOINT || undefined,
});

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return false;
    throw error;
  }
}

const target = env.DYNAMO_ENDPOINT ?? `AWS ${env.AWS_REGION}`;
const tables = [leadsTableDefinition(env.DYNAMO_TABLE), jobsTableDefinition(env.JOBS_TABLE)];

for (const definition of tables) {
  const name = definition.TableName ?? '';
  // eslint-disable-next-line no-await-in-loop -- dos tablas, en orden
  if (await tableExists(name)) {
    process.stdout.write(`La tabla "${name}" ya existe en ${target}.\n`);
  } else {
    // eslint-disable-next-line no-await-in-loop
    await client.send(new CreateTableCommand(definition));
    // eslint-disable-next-line no-await-in-loop
    await waitUntilTableExists({ client, maxWaitTime: TABLE_READY_TIMEOUT_S }, { TableName: name });
    process.stdout.write(`Tabla "${name}" creada en ${target}.\n`);
  }
}
