import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  type DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  type ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { PersistenceError } from '../../core/domain/errors/persistence.error.js';
import { type Lead, LeadSchema } from '../../core/domain/lead.js';
import type { LeadRepository, SaveLeadResult } from '../../core/ports/lead-repository.js';
import { describeError } from '../shared/describe-error.js';
import { LEADS_PARTITION_KEY } from './leads-table.js';

type ScanPage = Pick<ScanCommandOutput, 'Items' | 'LastEvaluatedKey'>;

export class DynamoLeadRepository implements LeadRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Escritura condicional: si el dominio ya existe, DynamoDB rechaza el `Put` de forma
   * atómica y se informa `duplicate` (sin leer antes ni carreras entre ejecuciones).
   */
  async save(lead: Lead): Promise<SaveLeadResult> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: lead,
          ConditionExpression: 'attribute_not_exists(#pk)',
          ExpressionAttributeNames: { '#pk': LEADS_PARTITION_KEY },
        }),
      );
      return 'created';
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return 'duplicate';
      throw new PersistenceError(
        `DynamoDB: no se pudo guardar ${lead.id}: ${describeError(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  // Scan paginado: suficiente para la PoC. En producción, consultas por índice (p. ej. GSI
  // por jobId o por fecha) en lugar de recorrer la tabla (ver limitaciones en el README).
  async findAll(): Promise<Lead[]> {
    const items: unknown[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      // eslint-disable-next-line no-await-in-loop -- cada página depende de la anterior
      const page = await this.scanPage(startKey);
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return this.parseItems(items);
  }

  private async scanPage(startKey: Record<string, unknown> | undefined): Promise<ScanPage> {
    try {
      return await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: startKey }),
      );
    } catch (error) {
      throw new PersistenceError(
        `DynamoDB: no se pudieron leer los leads: ${describeError(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  private parseItems(items: readonly unknown[]): Lead[] {
    const parsed = LeadSchema.array().safeParse(items);
    if (!parsed.success) {
      throw new PersistenceError('DynamoDB: hay leads almacenados que no cumplen el schema.');
    }
    return parsed.data;
  }
}
