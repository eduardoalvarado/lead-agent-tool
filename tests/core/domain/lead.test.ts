import { describe, expect, it } from 'vitest';
import { isAggregatorDomain } from '../../../src/core/domain/aggregator-domains.js';
import { toDomainKey } from '../../../src/core/domain/domain-name.js';
import { LeadCandidateSchema } from '../../../src/core/domain/lead.js';
import { buildCandidate } from '../../support/fakes.js';

describe('LeadCandidateSchema', () => {
  it('acepta un candidato completo', () => {
    expect(LeadCandidateSchema.safeParse(buildCandidate()).success).toBe(true);
  });

  it('acepta contactos en null cuando no aparecen en la fuente', () => {
    const candidate = buildCandidate({
      contact: { website: 'https://sonrisaclara.pe', email: null, phone: null, address: null },
    });
    expect(LeadCandidateSchema.safeParse(candidate).success).toBe(true);
  });

  it.each([
    ['sin sourceUrl', { sourceUrl: undefined }],
    [
      'con un sectorMatch desconocido',
      {
        qualificationSignals: {
          sectorMatch: 'none',
          locationEvidence: 'confirmed',
          maturitySignals: [],
        },
      },
    ],
    [
      'con demasiadas señales de madurez',
      {
        qualificationSignals: {
          sectorMatch: 'exact',
          locationEvidence: 'confirmed',
          maturitySignals: ['a1', 'b22', 'c33', 'd44', 'e55', 'f66'].map((x) => `señal ${x}`),
        },
      },
    ],
    ['confidence inválida', { confidence: 'very-high' }],
  ])('rechaza un candidato %s', (_case, overrides) => {
    const candidate = { ...buildCandidate(), ...overrides };
    expect(LeadCandidateSchema.safeParse(candidate).success).toBe(false);
  });

  it('rechaza un email inventado con formato inválido', () => {
    const base = buildCandidate();
    const candidate = { ...base, contact: { ...base.contact, email: 'no-tiene' } };
    expect(LeadCandidateSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    ['sin sitio web', null],
    ['con una red social como web', 'https://www.instagram.com/clinica'],
    ['con un directorio como web', 'https://www.doctoralia.pe/clinica-x'],
    ['con un protocolo no http', 'ftp://sonrisaclara.pe'],
  ])('rechaza un candidato %s', (_case, website) => {
    const base = buildCandidate();
    const candidate = { ...base, contact: { ...base.contact, website } };
    expect(LeadCandidateSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('toDomainKey', () => {
  it.each([
    ['https://www.Sonrisaclara.pe/contacto', 'sonrisaclara.pe'],
    ['http://sonrisaclara.pe', 'sonrisaclara.pe'],
    ['https://citas.sonrisaclara.pe/?a=1', 'citas.sonrisaclara.pe'],
  ])('normaliza %s → %s', (url, expected) => {
    expect(toDomainKey(url)).toBe(expected);
  });
});

describe('isAggregatorDomain', () => {
  it('detecta dominios y subdominios de agregadores', () => {
    expect(isAggregatorDomain('instagram.com')).toBe(true);
    expect(isAggregatorDomain('m.facebook.com')).toBe(true);
  });

  it('no confunde dominios propios que contienen el nombre', () => {
    expect(isAggregatorDomain('sonrisaclara.pe')).toBe(false);
    expect(isAggregatorDomain('notfacebook.com')).toBe(false);
  });
});
