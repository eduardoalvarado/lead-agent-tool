import { z } from 'zod';
import type { LeadContact } from './lead.js';

// Puntaje de cualificación determinista: el LLM aporta señales (juicio con evidencia) y el
// código calcula los puntos. Contactabilidad y legitimidad se derivan de los datos extraídos.

export const SECTOR_MATCHES = ['exact', 'related'] as const;
export const LOCATION_EVIDENCE = ['confirmed', 'inferred'] as const;

/** Puntos de la rúbrica: fuente única para el cálculo y para el texto del prompt. */
export const QUALIFICATION_POINTS = {
  fit: {
    sector: { exact: 20, related: 10 },
    location: { confirmed: 15, inferred: 5 },
  },
  legitimacy: { ownWebsite: 15, address: 10 },
  contactability: { email: 10, phone: 10, address: 5 },
  maturity: { perSignal: 5, maxSignals: 3 },
} as const;

const P = QUALIFICATION_POINTS;

/** Máximo de cada criterio, derivado de los puntos (suma 100). */
export const QUALIFICATION_MAX = {
  fit: P.fit.sector.exact + P.fit.location.confirmed,
  legitimacy: P.legitimacy.ownWebsite + P.legitimacy.address,
  contactability: P.contactability.email + P.contactability.phone + P.contactability.address,
  maturity: P.maturity.perSignal * P.maturity.maxSignals,
} as const;

export const QualificationSignalsSchema = z
  .object({
    sectorMatch: z
      .enum(SECTOR_MATCHES)
      .describe('exact: la empresa es del sector pedido; related: es de un sector afín.'),
    locationEvidence: z
      .enum(LOCATION_EVIDENCE)
      .describe(
        'confirmed: la fuente menciona la ubicación pedida (ciudad o distrito); inferred: solo se deduce.',
      ),
    maturitySignals: z
      .array(z.string().trim().min(3).max(120))
      .max(5)
      .describe(
        'Señales explícitas de tamaño o madurez copiadas de la fuente (p. ej. "2 sedes", "12 especialistas", "desde 2015"). Lista vacía si no hay.',
      ),
  })
  .describe('Señales para cualificar el lead; el puntaje lo calcula el sistema a partir de ellas.');

export type QualificationSignals = z.infer<typeof QualificationSignalsSchema>;

export const QualificationBreakdownSchema = z.object({
  fit: z.number().int().min(0).max(QUALIFICATION_MAX.fit),
  legitimacy: z.number().int().min(0).max(QUALIFICATION_MAX.legitimacy),
  contactability: z.number().int().min(0).max(QUALIFICATION_MAX.contactability),
  maturity: z.number().int().min(0).max(QUALIFICATION_MAX.maturity),
});

export type QualificationBreakdown = z.infer<typeof QualificationBreakdownSchema>;

export interface Qualification {
  readonly score: number;
  readonly breakdown: QualificationBreakdown;
  readonly reason: string;
}

const SECTOR_LABEL = { exact: 'sector exacto', related: 'sector afín' } as const;
const LOCATION_LABEL = {
  confirmed: 'ubicación confirmada',
  inferred: 'ubicación inferida',
} as const;

function contactItems(contact: LeadContact): string[] {
  return [
    contact.email ? 'email' : null,
    contact.phone ? 'teléfono' : null,
    contact.address ? 'dirección' : null,
  ].filter((item): item is string => item !== null);
}

/** Calcula puntaje, desglose y justificación: mismos datos, mismo resultado. */
export function scoreQualification(
  signals: QualificationSignals,
  contact: LeadContact,
): Qualification {
  const maturitySignals = [...new Set(signals.maturitySignals)].slice(0, P.maturity.maxSignals);
  const breakdown: QualificationBreakdown = {
    fit: P.fit.sector[signals.sectorMatch] + P.fit.location[signals.locationEvidence],
    legitimacy: P.legitimacy.ownWebsite + (contact.address ? P.legitimacy.address : 0),
    contactability:
      (contact.email ? P.contactability.email : 0) +
      (contact.phone ? P.contactability.phone : 0) +
      (contact.address ? P.contactability.address : 0),
    maturity: maturitySignals.length * P.maturity.perSignal,
  };
  const contacts = contactItems(contact);
  const reason = [
    `Encaje ${breakdown.fit} (${SECTOR_LABEL[signals.sectorMatch]}, ${LOCATION_LABEL[signals.locationEvidence]})`,
    `Legitimidad ${breakdown.legitimacy} (web propia${contact.address ? ', dirección física' : ''})`,
    `Contactabilidad ${breakdown.contactability} (${contacts.length > 0 ? contacts.join(', ') : 'sin datos de contacto'})`,
    `Madurez ${breakdown.maturity} (${maturitySignals.length > 0 ? maturitySignals.join('; ') : 'sin señales'})`,
  ].join(' · ');

  return {
    score: breakdown.fit + breakdown.legitimacy + breakdown.contactability + breakdown.maturity,
    breakdown,
    reason,
  };
}
