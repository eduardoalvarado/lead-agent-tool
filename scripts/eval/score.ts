// Métricas de una ejecución del agente frente a un caso dorado. Funciones puras (testeadas).
import { toDomainKey } from '../../src/core/domain/domain-name.js';
import type { Lead } from '../../src/core/domain/lead.js';
import type { AgentRunSummary } from '../../src/core/domain/run-summary.js';
import type { GoldenCase } from './golden-cases.js';

export interface Hallucination {
  readonly leadId: string;
  readonly field: 'website' | 'email' | 'phone' | 'address';
  readonly value: string;
}

export interface RunScore {
  readonly caseId: string;
  readonly saved: readonly string[];
  readonly precision: number;
  readonly recall: number;
  readonly trapsSaved: readonly string[];
  readonly trapsDiscarded: readonly string[];
  readonly hallucinations: readonly Hallucination[];
  readonly stopReason: AgentRunSummary['stopReason'];
  readonly iterations: number;
  readonly usage: AgentRunSummary['usage'];
}

/** Texto fuente por dominio (todo lo que el agente pudo leer de esa empresa). */
export type SourceLookup = (domain: string) => string | undefined;

const PHONE_DIGITS_COMPARED = 7;

const digits = (text: string) => text.replace(/\D/g, '');

function safeDomain(url: string): string | null {
  try {
    return toDomainKey(url);
  } catch {
    return null;
  }
}

/** Un dato es alucinado si no aparece en el texto fuente de la empresa (comparación tolerante a formato). */
function findHallucinations(lead: Lead, source: SourceLookup): Hallucination[] {
  const text = source(lead.id);
  if (text === undefined)
    return [{ leadId: lead.id, field: 'website', value: lead.contact.website }];

  const lower = text.toLowerCase();
  const { email, phone, address } = lead.contact;
  const issues: Hallucination[] = [];
  if (email && !lower.includes(email.toLowerCase())) {
    issues.push({ leadId: lead.id, field: 'email', value: email });
  }
  if (phone && !digits(text).includes(digits(phone).slice(-PHONE_DIGITS_COMPARED))) {
    issues.push({ leadId: lead.id, field: 'phone', value: phone });
  }
  const street = address?.split(',')[0]?.trim().toLowerCase();
  if (address && street && !lower.includes(street)) {
    issues.push({ leadId: lead.id, field: 'address', value: address });
  }
  return issues;
}

const ratio = (part: number, total: number) => (total === 0 ? 0 : part / total);

export function scoreRun(
  summary: AgentRunSummary,
  golden: GoldenCase,
  source: SourceLookup,
): RunScore {
  const saved = summary.savedLeads.map((lead) => lead.id);
  const hits = saved.filter((id) => golden.expected.includes(id));
  const discardedDomains = new Set(summary.discarded.map((d) => safeDomain(d.url)));
  return {
    caseId: golden.id,
    saved,
    precision: ratio(hits.length, saved.length),
    recall: ratio(hits.length, golden.expected.length),
    trapsSaved: saved.filter((id) => golden.traps.includes(id)),
    trapsDiscarded: golden.traps.filter((trap) => discardedDomains.has(trap)),
    hallucinations: summary.savedLeads.flatMap((lead) => findHallucinations(lead, source)),
    stopReason: summary.stopReason,
    iterations: summary.iterations,
    usage: summary.usage,
  };
}
