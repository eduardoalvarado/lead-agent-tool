import { CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDynamoDocumentClient } from '../../src/infrastructure/persistence/dynamo-client.factory.js';
import { DynamoLeadRepository } from '../../src/infrastructure/persistence/dynamo-lead-repository.js';
import { leadsTableDefinition } from '../../src/infrastructure/persistence/leads-table.js';
import { buildLead } from '../support/lead-fixtures.js';

// Requiere DynamoDB Local (docker compose up -d). Se ejecuta con: npm run test:integration
const ENDPOINT = process.env.DYNAMO_ENDPOINT ?? 'http://localhost:8000';
const TABLE = `leads-it-${Date.now()}`;
const client = createDynamoDocumentClient({ region: 'us-east-2', endpoint: ENDPOINT });

describe.skipIf(!process.env.RUN_INTEGRATION)('DynamoLeadRepository (DynamoDB Local)', () => {
  const repository = new DynamoLeadRepository(client, TABLE);

  beforeAll(async () => {
    await client.send(new CreateTableCommand(leadsTableDefinition(TABLE)));
  });

  afterAll(async () => {
    await client.send(new DeleteTableCommand({ TableName: TABLE }));
  });

  it('guarda, deduplica por dominio y lee los leads', async () => {
    expect(await repository.save(buildLead())).toBe('created');
    expect(await repository.save(buildLead({ jobId: 'job-2' }))).toBe('duplicate');
    expect(await repository.save(buildLead({ id: 'dentalia.pe' }))).toBe('created');

    const leads = await repository.findAll();

    expect(leads.map((lead) => lead.id).sort()).toEqual(['dentalia.pe', 'sonrisaclara.pe']);
    expect(leads.find((lead) => lead.id === 'sonrisaclara.pe')?.jobId).toBe('job-1');
  });
});
