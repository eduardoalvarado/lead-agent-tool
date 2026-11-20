import { describe, expect, it } from 'vitest';
import { type LeadAgentOptions, LeadAgent } from '../../../src/core/agent/lead-agent.js';
import { DiscardLeadTool } from '../../../src/core/agent/tools/discard-lead.tool.js';
import { SaveLeadTool } from '../../../src/core/agent/tools/save-lead.tool.js';
import { SearchWebTool } from '../../../src/core/agent/tools/search-web.tool.js';
import { LlmProviderError } from '../../../src/core/domain/errors/llm-provider.error.js';
import { SearchProviderError } from '../../../src/core/domain/errors/search-provider.error.js';
import type { LlmCompletion } from '../../../src/core/ports/llm-provider.js';
import type { SearchProvider } from '../../../src/core/ports/search-provider.js';
import {
  answer,
  buildCandidate,
  callTools,
  FakeLeadRepository,
  fixedClock,
  ScriptedLlm,
  SilentLogger,
  toolCall,
} from '../../support/fakes.js';

const criteria = { sector: 'Clínicas dentales', location: 'Lima, Perú' };
const searchProvider: SearchProvider = {
  search: async () => [{ title: 'Sonrisa Clara', url: 'https://sonrisaclara.pe', content: '…' }],
};

function setup(
  script: readonly LlmCompletion[],
  options: LeadAgentOptions = { maxIterations: 10, maxLeads: 10 },
  search: SearchProvider = searchProvider,
) {
  const llm = new ScriptedLlm(script);
  const repository = new FakeLeadRepository();
  const logger = new SilentLogger();
  const tools = [
    new SearchWebTool(search),
    new SaveLeadTool(repository, fixedClock),
    new DiscardLeadTool(),
  ];
  const agent = new LeadAgent(llm, tools, logger, options);
  return { agent, llm, repository, logger };
}

function lastToolMessage(llm: ScriptedLlm): string {
  const messages = llm.requests.at(-1)?.messages ?? [];
  const toolMessage = messages.findLast((message) => message.role === 'tool');
  return toolMessage?.content ?? '';
}

describe('LeadAgent', () => {
  it('ejecuta el ciclo buscar → guardar → descartar → responder', async () => {
    const { agent, repository } = setup([
      callTools(toolCall('search_web', { query: 'clínicas dentales Lima' })),
      callTools(
        toolCall('save_lead', buildCandidate(), 'call-1'),
        toolCall(
          'discard_lead',
          { companyName: 'Guía Médica', url: 'https://guia.pe', reason: 'Directorio' },
          'call-2',
        ),
      ),
      answer('Guardé 1 lead y descarté 1 directorio.'),
    ]);

    const summary = await agent.run(criteria, 'job-1');

    expect(summary).toMatchObject({
      jobId: 'job-1',
      stopReason: 'completed',
      iterations: 3,
      discarded: [{ companyName: 'Guía Médica', url: 'https://guia.pe', reason: 'Directorio' }],
      finalMessage: 'Guardé 1 lead y descarté 1 directorio.',
    });
    expect(summary.savedLeads.map((lead) => lead.id)).toEqual(['sonrisaclara.pe']);
    expect(repository.saved).toHaveLength(1);
  });

  it('ofrece al LLM los tools y el contexto de la búsqueda', async () => {
    const { agent, llm } = setup([answer('Nada que hacer.')]);

    await agent.run(criteria, 'job-1');

    const [request] = llm.requests;
    expect(request?.tools.map((tool) => tool.name)).toEqual([
      'search_web',
      'save_lead',
      'discard_lead',
    ]);
    expect(request?.messages[1]?.content).toContain('Clínicas dentales');
    expect(request?.messages[1]?.content).toContain('Lima, Perú');
  });

  it('devuelve el error de validación al LLM y le permite corregirse', async () => {
    const { agent, llm } = setup([
      callTools(toolCall('save_lead', { ...buildCandidate(), sourceUrl: 'no-es-url' })),
      callTools(toolCall('save_lead', buildCandidate())),
      answer('Corregido.'),
    ]);

    const summary = await agent.run(criteria, 'job-1');

    expect(llm.requests[1]?.messages.at(-1)?.content).toContain('ERROR DE VALIDACIÓN');
    expect(summary.savedLeads).toHaveLength(1);
  });

  it.each([
    ['un tool inexistente', toolCall('delete_db', {}), 'no existe'],
    ['argumentos que no son JSON', toolCall('search_web', '{query: sin comillas'), 'JSON válido'],
  ])('responde con un error cuando el LLM llama %s', async (_case, call, expected) => {
    const { agent, llm } = setup([callTools(call), answer('Fin.')]);

    const summary = await agent.run(criteria, 'job-1');

    expect(lastToolMessage(llm)).toContain(expected);
    expect(summary.stopReason).toBe('completed');
  });

  it('convierte un error de servicio externo en resultado del tool y continúa', async () => {
    const failingSearch: SearchProvider = {
      search: async () => {
        throw new SearchProviderError('Tavily: 429 rate limit');
      },
    };
    const { agent, llm, logger } = setup(
      [callTools(toolCall('search_web', { query: 'dentistas Lima' })), answer('Sin resultados.')],
      undefined,
      failingSearch,
    );

    const summary = await agent.run(criteria, 'job-1');

    expect(lastToolMessage(llm)).toBe('ERROR: Tavily: 429 rate limit');
    expect(summary.stopReason).toBe('completed');
    expect(logger.entries.some((entry) => entry.level === 'warn')).toBe(true);
  });

  it('propaga errores inesperados (bugs) en lugar de ocultarlos', async () => {
    const buggySearch: SearchProvider = {
      search: async () => {
        throw new TypeError('bug');
      },
    };
    const { agent } = setup(
      [callTools(toolCall('search_web', { query: 'dentistas Lima' }))],
      undefined,
      buggySearch,
    );

    await expect(agent.run(criteria, 'job-1')).rejects.toThrow(TypeError);
  });

  it('corta con llm_error y conserva lo avanzado si el LLM falla', async () => {
    const llm = new ScriptedLlm([callTools(toolCall('save_lead', buildCandidate()))]);
    const failingLlm = {
      complete: async (request: Parameters<ScriptedLlm['complete']>[0]) => {
        if (llm.requests.length > 0) throw new LlmProviderError('Groq: 413 TPM');
        return llm.complete(request);
      },
    };
    const repository = new FakeLeadRepository();
    const agent = new LeadAgent(
      failingLlm,
      [new SaveLeadTool(repository, fixedClock)],
      new SilentLogger(),
      { maxIterations: 10, maxLeads: 10 },
    );

    const summary = await agent.run(criteria, 'job-1');

    expect(summary).toMatchObject({ stopReason: 'llm_error', error: 'Groq: 413 TPM' });
    expect(summary.savedLeads).toHaveLength(1);
  });

  it('compacta las observaciones antiguas y conserva completas las recientes', async () => {
    const longSearch: SearchProvider = {
      search: async () => [{ title: 'T', url: 'https://a.pe', content: 'x'.repeat(490) }],
    };
    const discardA = { companyName: 'A', url: 'https://a.pe', reason: 'Otro sector' };
    const { agent, llm } = setup(
      [
        callTools(toolCall('search_web', { query: 'dentistas Lima' })),
        callTools(toolCall('discard_lead', discardA)),
        callTools(toolCall('discard_lead', { ...discardA, url: 'https://b.pe' })),
        answer('Fin.'),
      ],
      { maxIterations: 10, maxLeads: 10, compactObservations: true },
      longSearch,
    );

    await agent.run(criteria, 'job-1');

    const firstObservationLength = (request: number) =>
      llm.requests[request]?.messages.find((m) => m.role === 'tool')?.content.length;
    expect(firstObservationLength(2)).toBeGreaterThan(500);
    expect(firstObservationLength(3)).toBe(501);
  });

  it('no altera el historial cuando la compactación está desactivada', async () => {
    const { agent, llm } = setup([
      callTools(toolCall('search_web', { query: 'dentistas Lima' })),
      answer('Fin.'),
    ]);

    await agent.run(criteria, 'job-1');

    expect(llm.requests[1]?.messages.at(-1)?.content).toContain('sonrisaclara.pe');
  });

  it('se detiene al alcanzar el máximo de iteraciones', async () => {
    const search = callTools(toolCall('search_web', { query: 'dentistas Lima' }));
    const { agent, llm } = setup([search, search, search], { maxIterations: 2, maxLeads: 10 });

    const summary = await agent.run(criteria, 'job-1');

    expect(summary).toMatchObject({ stopReason: 'max_iterations', iterations: 2 });
    expect(llm.requests).toHaveLength(2);
  });

  it('se detiene al alcanzar el máximo de leads, sin ejecutar más tools', async () => {
    const second = buildCandidate({
      companyName: 'Dentalia',
      contact: { website: 'https://dentalia.pe', email: null, phone: null, address: null },
      sourceUrl: 'https://dentalia.pe',
    });
    const { agent, repository } = setup(
      [
        callTools(
          toolCall('save_lead', buildCandidate(), 'c1'),
          toolCall('save_lead', second, 'c2'),
        ),
      ],
      { maxIterations: 10, maxLeads: 1 },
    );

    const summary = await agent.run(criteria, 'job-1');

    expect(summary.stopReason).toBe('max_leads');
    expect(repository.saved).toHaveLength(1);
  });

  it('registra en el log cada tool elegido con sus argumentos', async () => {
    const { agent, logger } = setup([
      callTools(toolCall('search_web', { query: 'dentistas Lima' })),
      answer('Fin.'),
    ]);

    await agent.run(criteria, 'job-1');

    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        message: '[1] Tool → search_web',
        context: { args: { query: 'dentistas Lima' } },
      }),
    );
  });
});
