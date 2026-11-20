import { z } from 'zod';
import { isAggregatorDomain } from './aggregator-domains.js';
import { toDomainKey } from './domain-name.js';

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

const httpUrl = () => z.url({ protocol: /^https?$/ });

// Las descripciones se envían al LLM como parte del JSON Schema del tool `save_lead`:
// son instrucciones de extracción, no solo documentación.
export const LeadContactSchema = z.object({
  website: httpUrl()
    .refine((url) => !isAggregatorDomain(toDomainKey(url)), {
      message:
        'El sitio web es una red social, directorio o agregador; debe ser el dominio propio de la empresa.',
    })
    .describe('Sitio web oficial y propio de la empresa (no redes sociales ni directorios).'),
  email: z
    .email()
    .nullable()
    .describe('Email tal como aparece literalmente en la fuente; null si no aparece.'),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .nullable()
    .describe('Teléfono tal como aparece literalmente en la fuente; null si no aparece.'),
  address: z
    .string()
    .trim()
    .min(5)
    .max(300)
    .nullable()
    .describe('Dirección física tal como aparece en la fuente; null si no aparece.'),
});

/** Datos que el LLM extrae de la fuente y envía a `save_lead`. */
export const LeadCandidateSchema = z.object({
  companyName: z.string().trim().min(2).max(200).describe('Nombre comercial de la empresa.'),
  subSector: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .describe('Especialidad o nicho detectado dentro del sector solicitado.'),
  summary: z
    .string()
    .trim()
    .min(20)
    .max(600)
    .describe('Resumen de 1 a 3 frases de lo que hace la empresa, basado solo en la fuente.'),
  contact: LeadContactSchema,
  qualificationScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Puntaje 0-100 de utilidad del lead para el equipo comercial.'),
  qualificationReason: z
    .string()
    .trim()
    .min(10)
    .max(500)
    .describe('Justificación breve del puntaje citando señales observadas en la fuente.'),
  confidence: z
    .enum(CONFIDENCE_LEVELS)
    .describe('Confianza en la exactitud de los datos extraídos.'),
  sourceUrl: httpUrl().describe('URL exacta de la página de donde se extrajeron los datos.'),
});

export type LeadCandidate = z.infer<typeof LeadCandidateSchema>;

/** Lead persistido: datos extraídos + contexto de la ejecución, asignado por el código. */
export const LeadSchema = LeadCandidateSchema.extend({
  id: z.string().min(1),
  requestedSector: z.string().min(1),
  location: z.string().min(1),
  jobId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type Lead = z.infer<typeof LeadSchema>;
