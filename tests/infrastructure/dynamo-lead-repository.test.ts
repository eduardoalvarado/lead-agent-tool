import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { type DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { PersistenceError } from '../../src/core/domain/errors/persistence.error.js';
import { DynamoLeadRepository } from '../../src/infrastructure/persistence/dynamo-lead-repository.js';
import { buildLead } from '../support/lead-fixtures.js';

type Command = PutCommand | ScanCommand;
type Responder = (command: Command) => unknown;

/** Fake del DocumentClient: el repositorio solo usa `send`. Registra cada comando. */
function fakeClient(respond: Responder) {
  const sent: Command[] = [];
  const client = {
    send: async (command: Command) => {
      sent.push(command);
      return respond(command);
    },
  } as unknown as DynamoDBDocumentClient;
  return { client, sent };
}

describe('DynamoLeadRepository', () => {
  it('guarda con una escritura condicional por dominio', async () => {
    const { client, sent } = fakeClient(() => ({}));

    expect(await new DynamoLeadRepository(client, 'leads').save(buildLead())).toBe('created');
    expect(sent[0]).toBeInstanceOf(PutCommand);
    expect(sent[0]?.input).toMatchObject({
      TableName: 'leads',
      Item: { id: 'sonrisaclara.pe' },
      ConditionExpression: 'attribute_not_exists(#pk)',
      ExpressionAttributeNames: { '#pk': 'id' },
    });
  });

  it('informa duplicate cuando el dominio ya existe', async () => {
    const { client } = fakeClient(() => {
      throw new ConditionalCheckFailedException({ message: 'exists', $metadata: {} });
    });

    expect(await new DynamoLeadRepository(client, 'leads').save(buildLead())).toBe('duplicate');
  });

  it('traduce otros errores del SDK a PersistenceError', async () => {
    const { client } = fakeClient(() => {
      throw new Error('ResourceNotFoundException');
    });

    await expect(new DynamoLeadRepository(client, 'leads').save(buildLead())).rejects.toThrow(
      PersistenceError,
    );
  });

  it('lee todas las páginas y valida los ítems', async () => {
    const pages = [
      { Items: [buildLead()], LastEvaluatedKey: { id: 'sonrisaclara.pe' } },
      { Items: [buildLead({ id: 'dentalia.pe' })] },
    ];
    const { client, sent } = fakeClient(() => pages.shift());

    const leads = await new DynamoLeadRepository(client, 'leads').findAll();

    expect(leads.map((lead) => lead.id)).toEqual(['sonrisaclara.pe', 'dentalia.pe']);
    expect(sent[1]?.input).toMatchObject({ ExclusiveStartKey: { id: 'sonrisaclara.pe' } });
  });

  it('rechaza datos almacenados que no cumplen el schema', async () => {
    const { client } = fakeClient(() => ({ Items: [{ id: 'roto.pe' }] }));

    await expect(new DynamoLeadRepository(client, 'leads').findAll()).rejects.toThrow(
      PersistenceError,
    );
  });
});
