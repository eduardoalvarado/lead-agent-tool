import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface DynamoClientOptions {
  readonly region: string;
  /** Endpoint de DynamoDB Local; vacío en AWS real. */
  readonly endpoint?: string | undefined;
}

// DynamoDB Local exige credenciales pero no las valida. Se pasan explícitamente solo en
// modo local para no pisar la cadena de credenciales real de AWS (perfil, rol IAM).
const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

export function createDynamoDocumentClient({
  region,
  endpoint,
}: DynamoClientOptions): DynamoDBDocumentClient {
  const client = new DynamoDBClient(
    endpoint ? { region, endpoint, credentials: LOCAL_CREDENTIALS } : { region },
  );
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
