import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app/app.module.js';
import { DomainExceptionFilter } from '../../src/app/common/domain-exception.filter.js';
import { loadAppConfig } from '../../src/app/config/app-config.js';
import {
  APP_CONFIG,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LEAD_REPOSITORY,
  LLM_PROVIDER,
} from '../../src/app/providers/tokens.js';
import { PersistenceError } from '../../src/core/domain/errors/persistence.error.js';
import { LlmProviderError } from '../../src/core/domain/errors/llm-provider.error.js';
import type { LeadRepository } from '../../src/core/ports/lead-repository.js';
import type { LLMProvider, LlmCompletion } from '../../src/core/ports/llm-provider.js';
import {
  answer,
  buildCandidate,
  callTools,
  FakeJobQueue,
  FakeJobRepository,
  FakeLeadRepository,
  ScriptedLlm,
  toolCall,
} from '../support/fakes.js';

// e2e de la capa HTTP: la app Nest real con su composition root; solo se reemplazan el LLM
// (guion determinista) y el repositorio (en memoria). Búsqueda en modo mock, sin red.
const TEST_CONFIG = loadAppConfig({
  LLM_API_KEY: 'test',
  SEARCH_PROVIDER: 'mock',
  LOG_LEVEL: 'error',
});

let app: INestApplication | undefined;

async function startApp(llm: LLMProvider, repository: LeadRepository): Promise<string> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(TEST_CONFIG)
    .overrideProvider(LLM_PROVIDER)
    .useValue(llm)
    .overrideProvider(LEAD_REPOSITORY)
    .useValue(repository)
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(0);
  return app.getUrl();
}

function postSearch(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/leads/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const happyPath: LlmCompletion[] = [
  callTools(toolCall('search_web', { query: 'clínica dental Lima' })),
  callTools(toolCall('save_lead', buildCandidate())),
  answer('Guardé 1 lead.'),
];

describe('LeadsController (e2e)', () => {
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('POST /leads/search ejecuta el agente y GET /leads devuelve lo guardado', async () => {
    const baseUrl = await startApp(new ScriptedLlm(happyPath), new FakeLeadRepository());

    const search = await postSearch(baseUrl, {
      sector: 'Clínicas dentales',
      location: 'Lima, Perú',
    });
    const summary = await search.json();
    const list = await (await fetch(`${baseUrl}/leads`)).json();

    expect(search.status).toBe(200);
    expect(summary).toMatchObject({
      stopReason: 'completed',
      criteria: { sector: 'Clínicas dentales', location: 'Lima, Perú' },
      savedLeads: [{ id: 'sonrisaclara.pe', requestedSector: 'Clínicas dentales' }],
      finalMessage: 'Guardé 1 lead.',
    });
    expect(list).toEqual([expect.objectContaining({ id: 'sonrisaclara.pe' })]);
  });

  it('POST /leads/search rechaza una entrada inválida con 400', async () => {
    const baseUrl = await startApp(new ScriptedLlm([]), new FakeLeadRepository());

    const response = await postSearch(baseUrl, { sector: 'x' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'Entrada inválida' });
  });

  it('POST /leads/search informa llm_error sin perder lo avanzado si el LLM falla', async () => {
    const llm: LLMProvider = {
      complete: async () => {
        throw new LlmProviderError('Groq: 429 rate limit');
      },
    };
    const baseUrl = await startApp(llm, new FakeLeadRepository());

    const response = await postSearch(baseUrl, { sector: 'Dentistas', location: 'Lima' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      stopReason: 'llm_error',
      error: 'Groq: 429 rate limit',
      savedLeads: [],
    });
  });

  it('GET /leads traduce un fallo de persistencia a 503', async () => {
    const failingRepository: LeadRepository = {
      save: async () => 'created',
      findAll: async () => {
        throw new PersistenceError('DynamoDB no disponible');
      },
    };
    const baseUrl = await startApp(new ScriptedLlm([]), failingRepository);

    const response = await fetch(`${baseUrl}/leads`);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PERSISTENCE_ERROR' });
  });
});

describe('Flujo asíncrono (EXECUTION_MODE=async, e2e)', () => {
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('POST /leads/search responde 202 con el jobId y GET /jobs/{id} devuelve el job', async () => {
    const jobs = new FakeJobRepository();
    const queue = new FakeJobQueue();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadAppConfig({
          LLM_API_KEY: 'test',
          EXECUTION_MODE: 'async',
          JOBS_QUEUE_URL: 'https://sqs.us-east-2.amazonaws.com/0/jobs',
          LOG_LEVEL: 'error',
        }),
      )
      .overrideProvider(JOB_REPOSITORY)
      .useValue(jobs)
      .overrideProvider(JOB_QUEUE)
      .useValue(queue)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0);
    const baseUrl = await app.getUrl();

    const accepted = await postSearch(baseUrl, {
      sector: 'Clínicas dentales',
      location: 'Lima, Perú',
    });
    const body = (await accepted.json()) as { jobId: string; statusUrl: string };
    const status = await fetch(`${baseUrl}${body.statusUrl}`);
    const missing = await fetch(`${baseUrl}/jobs/no-existe`);

    expect(accepted.status).toBe(202);
    expect(queue.messages).toEqual([
      { jobId: body.jobId, criteria: { sector: 'Clínicas dentales', location: 'Lima, Perú' } },
    ]);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ jobId: body.jobId, status: 'pending' });
    expect(missing.status).toBe(404);
  });
});
