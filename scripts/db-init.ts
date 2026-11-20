// Crea la tabla de leads si no existe (idempotente). Uso: npm run db:init
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { z } from 'zod';
import { createDynamoDocumentClient } from '../src/infrastructure/persistence/dynamo-client.factory.js';
import { leadsTableDefinition } from '../src/infrastructure/persistence/leads-table.js';

const EnvSchema = z.object({
  AWS_REGION: z.string().default('us-east-2'),
  DYNAMO_ENDPOINT: z.string().optional(),
  DYNAMO_TABLE: z.string().min(1).default('leads'),
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
if (await tableExists(env.DYNAMO_TABLE)) {
  process.stdout.write(`La tabla "${env.DYNAMO_TABLE}" ya existe en ${target}.\n`);
} else {
  await client.send(new CreateTableCommand(leadsTableDefinition(env.DYNAMO_TABLE)));
  await waitUntilTableExists(
    { client, maxWaitTime: TABLE_READY_TIMEOUT_S },
    { TableName: env.DYNAMO_TABLE },
  );
  process.stdout.write(`Tabla "${env.DYNAMO_TABLE}" creada en ${target}.\n`);
}
