import { z } from 'zod';
import { LeadSchema } from './lead.js';
import { SearchCriteriaSchema } from './search-criteria.js';

// Job de búsqueda del flujo asíncrono: la API lo crea y responde 202; el worker lo ejecuta.

export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Resumen de la ejecución tal como se guarda en el job (espejo de AgentRunSummary). */
const StoredRunSummarySchema = z.object({
  jobId: z.string().min(1),
  criteria: SearchCriteriaSchema,
  savedLeads: z.array(LeadSchema),
  discarded: z.array(z.object({ companyName: z.string(), url: z.string(), reason: z.string() })),
  iterations: z.number().int().min(0),
  stopReason: z.enum(['completed', 'max_iterations', 'max_leads', 'llm_error']),
  finalMessage: z.string().nullable(),
  error: z.string().nullable(),
  usage: z.object({
    llmCalls: z.number().int().min(0),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
  }),
});

export const JobSchema = z.object({
  jobId: z.string().min(1),
  criteria: SearchCriteriaSchema,
  status: z.enum(JOB_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  summary: StoredRunSummarySchema.nullable(),
  error: z.string().nullable(),
});

export type Job = z.infer<typeof JobSchema>;

/** Mensaje que la API encola y el worker consume. */
export const JobMessageSchema = z.object({
  jobId: z.string().min(1),
  criteria: SearchCriteriaSchema,
});

export type JobMessage = z.infer<typeof JobMessageSchema>;
