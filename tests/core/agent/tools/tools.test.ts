import { describe, expect, it } from 'vitest';
import { CandidateLedger } from '../../../../src/core/agent/candidate-ledger.js';
import type { ToolExecutionContext } from '../../../../src/core/agent/tools/agent-tool.js';
import { DiscardLeadTool } from '../../../../src/core/agent/tools/discard-lead.tool.js';
import { FetchPageTool } from '../../../../src/core/agent/tools/fetch-page.tool.js';
import { SaveLeadTool } from '../../../../src/core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../../../src/core/agent/tools/search-web.tool.js';
import type { PageFetcher } from '../../../../src/core/ports/page-fetcher.js';
import type { SearchProvider } from '../../../../src/core/ports/search-provider.js';
import {
  buildCandidate,
  FakeLeadRepository,
  FIXED_DATE,
  fixedClock,
} from '../../../support/fakes.js';

const newContext = (): ToolExecutionContext => ({
  criteria: { sector: 'Clínicas dentales', location: 'Lima, Perú' },
  jobId: 'job-1',
  ledger: new CandidateLedger(),
});
const context = newContext();

describe('SaveLeadTool', () => {
  it('guarda el lead con id = dominio y el contexto asignado por el código', async () => {
    const repository = new FakeLeadRepository();
    const result = await new SaveLeadTool(repository, fixedClock).execute(
      buildCandidate(),
      context,
    );

    expect(result.outcome.kind).toBe('saved');
    expect(repository.saved[0]).toMatchObject({
      id: 'sonrisaclara.pe',
      requestedSector: 'Clínicas dentales',
      location: 'Lima, Perú',
      jobId: 'job-1',
      createdAt: FIXED_DATE.toISOString(),
      // Calculado por el código: encaje 35 + legitimidad 25 + contactabilidad 25 + madurez 5.
      qualificationScore: 90,
      qualificationBreakdown: { fit: 35, legitimacy: 25, contactability: 25, maturity: 5 },
    });
  });

  it('devuelve el error de validación al LLM sin guardar ni lanzar', async () => {
    const repository = new FakeLeadRepository();
    const invalid = {
      ...buildCandidate(),
      qualificationSignals: {
        sectorMatch: 'mucho',
        locationEvidence: 'confirmed',
        maturitySignals: [],
      },
    };

    const result = await new SaveLeadTool(repository, fixedClock).execute(invalid, context);

    expect(result.outcome.kind).toBe('none');
    expect(result.output).toContain('ERROR DE VALIDACIÓN');
    expect(result.output).toContain('sectorMatch');
    expect(repository.saved).toHaveLength(0);
  });

  it('registra un duplicado como descartado', async () => {
    const tool = new SaveLeadTool(new FakeLeadRepository(), fixedClock);
    await tool.execute(buildCandidate(), context);

    const result = await tool.execute(buildCandidate(), context);

    expect(result.output).toContain('DUPLICADO');
    expect(result.outcome).toMatchObject({ kind: 'discarded' });
  });

  it('expone al LLM un JSON Schema con descripciones y sin $schema', () => {
    const { parameters } = new SaveLeadTool(new FakeLeadRepository(), fixedClock).definition;

    expect(parameters).not.toHaveProperty('$schema');
    expect(parameters).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['companyName', 'contact', 'sourceUrl']),
    });
    expect(JSON.stringify(parameters)).toContain('null si no aparece');
  });
});

describe('SearchWebTool', () => {
  const provider: SearchProvider = {
    search: async () => [{ title: 'Clínica', url: 'https://a.pe', content: 'x'.repeat(50) }],
  };

  it('devuelve resultados compactos y trunca los extractos', async () => {
    const tool = new SearchWebTool(provider, { maxResults: 3, maxSnippetChars: 10 });

    const result = await tool.execute({ query: 'clínicas dentales Lima' }, newContext());

    expect(JSON.parse(result.output)).toEqual([
      { title: 'Clínica', url: 'https://a.pe', content: `${'x'.repeat(10)}…` },
    ]);
  });

  it('omite resultados ya vistos y avisa cuando no hay novedades', async () => {
    const tool = new SearchWebTool(provider);
    const runContext = newContext();

    const first = await tool.execute({ query: 'clínicas dentales Lima' }, runContext);
    runContext.ledger.markDecided('https://a.pe');
    const second = await tool.execute({ query: 'dentistas Lima' }, runContext);

    expect(JSON.parse(first.output)).toHaveLength(1);
    expect(second.output).toContain('SIN NOVEDADES');
  });

  it('bloquea una nueva búsqueda mientras haya resultados sin decidir', async () => {
    const searched: string[] = [];
    const tool = new SearchWebTool({
      search: async (query) => {
        searched.push(query);
        return [{ title: 'Clínica', url: 'https://a.pe', content: '…' }];
      },
    });
    const runContext = newContext();

    await tool.execute({ query: 'clínicas dentales Lima' }, runContext);
    const blocked = await tool.execute({ query: 'dentistas Lima' }, runContext);

    expect(blocked.output).toContain('BLOQUEADO');
    expect(blocked.output).toContain('https://a.pe');
    expect(searched).toEqual(['clínicas dentales Lima']);
  });

  it('avisa cuando no hay resultados', async () => {
    const tool = new SearchWebTool({ search: async () => [] });
    const result = await tool.execute({ query: 'nada por aquí' }, context);
    expect(result.output).toContain('Sin resultados');
  });

  it('rechaza una consulta vacía', async () => {
    const result = await new SearchWebTool(provider).execute({ query: '' }, context);
    expect(result.output).toContain('ERROR DE VALIDACIÓN');
  });
});

describe('FetchPageTool', () => {
  it('trunca el texto e indica si fue truncado', async () => {
    const fetcher: PageFetcher = {
      fetch: async (url) => ({ url, title: 'Contacto', text: 'abcdefghij' }),
    };

    const result = await new FetchPageTool(fetcher, 4).execute({ url: 'https://a.pe' }, context);

    expect(JSON.parse(result.output)).toEqual({
      url: 'https://a.pe',
      title: 'Contacto',
      text: 'abcd…',
      truncated: true,
    });
  });
});

describe('FetchPageTool — guarda de flujo', () => {
  const fetcher: PageFetcher = { fetch: async (url) => ({ url, title: null, text: 'texto' }) };

  it('bloquea leer otra empresa mientras una leída siga sin decidir', async () => {
    const tool = new FetchPageTool(fetcher);
    const runContext = newContext();

    await tool.execute({ url: 'https://a.pe/' }, runContext);
    const sameCompany = await tool.execute({ url: 'https://a.pe/contacto' }, runContext);
    const otherCompany = await tool.execute({ url: 'https://b.pe/' }, runContext);
    runContext.ledger.markDecided('https://a.pe/');
    const afterDeciding = await tool.execute({ url: 'https://b.pe/' }, runContext);

    expect(sameCompany.output).not.toContain('BLOQUEADO');
    expect(otherCompany.output).toContain('BLOQUEADO');
    expect(afterDeciding.output).not.toContain('BLOQUEADO');
  });
});

describe('DiscardLeadTool', () => {
  it('registra el candidato descartado con su motivo', async () => {
    const result = await new DiscardLeadTool().execute(
      { companyName: 'Guía Médica', url: 'https://guia.pe/dentistas', reason: 'Es un directorio' },
      context,
    );
    expect(result.outcome).toEqual({
      kind: 'discarded',
      candidate: {
        companyName: 'Guía Médica',
        url: 'https://guia.pe/dentistas',
        reason: 'Es un directorio',
      },
    });
  });
});
