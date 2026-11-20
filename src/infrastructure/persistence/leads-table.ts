import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Clave de partición: dominio normalizado del sitio web (deduplicación por diseño). */
export const LEADS_PARTITION_KEY = 'id';

/** Definición única de la tabla de leads (la usan `db:init` y la infraestructura como código). */
export function leadsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [{ AttributeName: LEADS_PARTITION_KEY, AttributeType: 'S' }],
    KeySchema: [{ AttributeName: LEADS_PARTITION_KEY, KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  };
}
