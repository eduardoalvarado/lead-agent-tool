import { QUALIFICATION_MAX, QUALIFICATION_POINTS as P } from '../../domain/qualification.js';

// Sección de cualificación del prompt. El LLM aporta señales con evidencia; el puntaje lo
// calcula el código (domain/qualification.ts) con los mismos puntos que se describen aquí.

export const CONFIDENCE_GUIDE = [
  'high: los datos se confirmaron en la web propia de la empresa (fetch_page).',
  'medium: los datos salen solo del extracto de búsqueda.',
  'low: datos parciales, ambiguos o contradictorios entre fuentes.',
] as const;

export function buildQualificationSection(): string {
  return `## Cualificación
No calculas el puntaje: lo calcula el sistema (0-100). Tú entregas qualificationSignals:
- sectorMatch: "exact" si la empresa es del sector pedido (${P.fit.sector.exact} pts) o "related" si es de un sector afín (${P.fit.sector.related}).
- locationEvidence: "confirmed" si la fuente menciona la ubicación pedida (${P.fit.location.confirmed}) o "inferred" si solo se deduce (${P.fit.location.inferred}).
- maturitySignals: señales explícitas de tamaño o madurez copiadas de la fuente: sedes, tamaño del equipo, años de operación, clientes o casos, variedad de servicios (${P.maturity.perSignal} pts cada una, máximo ${QUALIFICATION_MAX.maturity}). Lista vacía si no hay.
El sistema suma además legitimidad (web propia ${P.legitimacy.ownWebsite} + dirección ${P.legitimacy.address}) y contactabilidad (email ${P.contactability.email}, teléfono ${P.contactability.phone}, dirección ${P.contactability.address}) a partir de los datos de contacto: por eso copia esos datos tal cual y usa null cuando no aparezcan.
confidence:
${CONFIDENCE_GUIDE.map((line) => `- ${line}`).join('\n')}`;
}
