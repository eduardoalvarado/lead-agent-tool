// Crea la tabla de leads si no existe (idempotente). Uso: npm run db:init
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { createDynamoDocumentClient } from '../src/infrastructure/persistence/dynamo-client.factory.js';
import { leadsTableDefinition } from '../src/infrastructure/persistence/leads-table.js';

const EnvSchema = z.object({
  AWS_REGION: z.string().default('us-east-2'),
  DYNAMO_ENDPOINT: z.string().optional(),
  DYNAMO_TABLE: z.string().min(1).default('leads'),
});

const TABLE_READY_TIMEOUT_S = 30;
// DynamoDB Local tarda unos segundos en aceptar conexiones después de `docker compose up -d`:
// se reintenta mientras la conexión sea rechazada, en lugar de fallar en el primer intento.
const DATABASE_READY_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;
const CONNECTION_ERROR_CODES: ReadonlySet<unknown> = new Set(['ECONNREFUSED', 'ECONNRESET']);

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

function isConnectionError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && CONNECTION_ERROR_CODES.has(error.code);
}

async function tableExistsWhenReady(tableName: string, deadline: number): Promise<boolean> {
  try {
    return await tableExists(tableName);
  } catch (error) {
    if (!isConnectionError(error) || Date.now() >= deadline) throw error;
    await sleep(RETRY_DELAY_MS);
    return tableExistsWhenReady(tableName, deadline);
  }
}

const target = env.DYNAMO_ENDPOINT ?? `AWS ${env.AWS_REGION}`;
if (await tableExistsWhenReady(env.DYNAMO_TABLE, Date.now() + DATABASE_READY_TIMEOUT_MS)) {
  process.stdout.write(`La tabla "${env.DYNAMO_TABLE}" ya existe en ${target}.\n`);
} else {
  await client.send(new CreateTableCommand(leadsTableDefinition(env.DYNAMO_TABLE)));
  await waitUntilTableExists(
    { client, maxWaitTime: TABLE_READY_TIMEOUT_S },
    { TableName: env.DYNAMO_TABLE },
  );
  process.stdout.write(`Tabla "${env.DYNAMO_TABLE}" creada en ${target}.\n`);
}
