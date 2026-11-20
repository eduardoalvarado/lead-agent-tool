import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

export const JOBS_PARTITION_KEY = 'jobId';

/** Definición única de la tabla de jobs (la usan `db:init` y la infraestructura como código). */
export function jobsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [{ AttributeName: JOBS_PARTITION_KEY, AttributeType: 'S' }],
    KeySchema: [{ AttributeName: JOBS_PARTITION_KEY, KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  };
}
