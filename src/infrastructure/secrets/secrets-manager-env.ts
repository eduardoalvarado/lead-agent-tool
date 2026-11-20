import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { z } from 'zod';

// Las API keys de terceros (LLM, Tavily) viven en Secrets Manager, no en variables de entorno
// de la Lambda. Se leen una vez por contenedor (cold start) y se inyectan en el entorno.

const SecretValuesSchema = z.record(z.string(), z.string());

export async function loadSecretIntoEnv(secretId: string, region: string): Promise<string[]> {
  const client = new SecretsManagerClient({ region });
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const values = SecretValuesSchema.parse(JSON.parse(result.SecretString ?? '{}'));
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] ??= value;
  });
  return Object.keys(values);
}
