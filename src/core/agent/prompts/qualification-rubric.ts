// Rúbrica de cualificación: hace el qualificationScore explicable y reproducible.
// Cada criterio suma puntos solo por señales observadas en la fuente.

export interface RubricCriterion {
  readonly name: string;
  readonly maxPoints: number;
  readonly scoring: string;
}

export const QUALIFICATION_RUBRIC: readonly RubricCriterion[] = [
  {
    name: 'Encaje',
    maxPoints: 35,
    scoring:
      'sector exacto 20 (relacionado 10) + ubicación confirmada en la fuente 15 (solo inferida 5)',
  },
  {
    name: 'Legitimidad',
    maxPoints: 25,
    scoring: 'web propia con actividad clara 15 + dirección física o razón social visible 10',
  },
  {
    name: 'Contactabilidad',
    maxPoints: 25,
    scoring: 'email 10 + teléfono 10 + dirección 5 (solo los que aparecen literalmente)',
  },
  {
    name: 'Madurez',
    maxPoints: 15,
    scoring:
      '5 por cada señal explícita: varias sedes, tamaño del equipo, años de operación, clientes o casos, variedad de servicios',
  },
];

export const CONFIDENCE_GUIDE = [
  'high: los datos se confirmaron en la web propia de la empresa (fetch_page).',
  'medium: los datos salen solo del extracto de búsqueda.',
  'low: datos parciales, ambiguos o contradictorios entre fuentes.',
] as const;

export function buildQualificationSection(): string {
  const criteria = QUALIFICATION_RUBRIC.map(
    ({ name, maxPoints, scoring }) => `- ${name} (0-${maxPoints}): ${scoring}.`,
  ).join('\n');
  return `## Cualificación
qualificationScore (0-100) es la suma de estos criterios:
${criteria}
qualificationReason: 1 o 2 frases en español que citen las señales concretas que sumaron puntos.
Ejemplo de estilo: "Clínica de ortodoncia en Miraflores (encaje 35), web propia con dirección (25), teléfono y email publicados (25), 2 sedes (5)."
confidence:
${CONFIDENCE_GUIDE.map((line) => `- ${line}`).join('\n')}`;
}
