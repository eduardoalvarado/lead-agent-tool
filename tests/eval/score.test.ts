import { describe, expect, it } from 'vitest';
import type { AgentRunSummary } from '../../src/core/domain/run-summary.js';
import type { GoldenCase } from '../../scripts/eval/golden-cases.js';
import { scoreRun } from '../../scripts/eval/score.js';
import { buildLead } from '../support/lead-fixtures.js';

const golden: GoldenCase = {
  id: 'dental',
  sector: 'Clínicas dentales',
  location: 'Lima',
  expected: ['sonrisaclara.pe', 'dentalia.pe'],
  traps: ['guia.pe'],
};

const source = (domain: string) =>
  ({
    'sonrisaclara.pe':
      'Citas: (01) 241-7788. Av. Benavides 1920, Miraflores. citas@sonrisaclara.pe',
    'guia.pe': 'Directorio de dentistas',
  })[domain];

function summary(overrides: Partial<AgentRunSummary>): AgentRunSummary {
  return {
    jobId: 'j',
    criteria: { sector: 'x', location: 'y' },
    savedLeads: [],
    discarded: [],
    iterations: 3,
    stopReason: 'completed',
    finalMessage: null,
    error: null,
    usage: { llmCalls: 3, inputTokens: 0, outputTokens: 0 },
    ...overrides,
  };
}

describe('scoreRun', () => {
  it('calcula precisión y recall frente a los leads esperados', () => {
    const score = scoreRun(summary({ savedLeads: [buildLead()] }), golden, source);

    expect(score).toMatchObject({ precision: 1, recall: 0.5, trapsSaved: [], hallucinations: [] });
  });

  it('acepta datos copiados con otro formato (teléfono con prefijo, dirección ampliada)', () => {
    const base = buildLead();
    const lead = {
      ...base,
      contact: {
        ...base.contact,
        phone: '+51 1 241 7788',
        address: 'Av. Benavides 1920, Miraflores, Lima, Perú',
      },
    };

    expect(scoreRun(summary({ savedLeads: [lead] }), golden, source).hallucinations).toEqual([]);
  });

  it('detecta datos de contacto que no están en la fuente', () => {
    const base = buildLead();
    const lead = {
      ...base,
      contact: { ...base.contact, email: 'ventas@sonrisaclara.pe', phone: '999 888 777' },
    };

    expect(scoreRun(summary({ savedLeads: [lead] }), golden, source).hallucinations).toEqual([
      { leadId: 'sonrisaclara.pe', field: 'email', value: 'ventas@sonrisaclara.pe' },
      { leadId: 'sonrisaclara.pe', field: 'phone', value: '999 888 777' },
    ]);
  });

  it('detecta trampas guardadas y descartadas', () => {
    const trap = buildLead({ id: 'guia.pe' });
    const score = scoreRun(
      summary({
        savedLeads: [trap],
        discarded: [{ companyName: 'Guía', url: 'https://www.guia.pe/lima', reason: 'Directorio' }],
      }),
      golden,
      source,
    );

    expect(score.trapsSaved).toEqual(['guia.pe']);
    expect(score.trapsDiscarded).toEqual(['guia.pe']);
    expect(score.precision).toBe(0);
  });

  it('marca como inventado un sitio web que no existe en la fuente', () => {
    const lead = buildLead({ id: 'inventado.pe' });

    expect(scoreRun(summary({ savedLeads: [lead] }), golden, source).hallucinations).toEqual([
      { leadId: 'inventado.pe', field: 'website', value: lead.contact.website },
    ]);
  });
});
