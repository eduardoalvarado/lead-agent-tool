import type { Lead } from './lead.js';
import type { SearchCriteria } from './search-criteria.js';

/**
 * Por qué terminó el agente: por decisión propia (`completed`), por una guarda (iteraciones,
 * leads o plazo de ejecución) o por un fallo del LLM.
 */
export const STOP_REASONS = [
  'completed',
  'max_iterations',
  'max_leads',
  'time_limit',
  'llm_error',
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

export interface DiscardedCandidate {
  readonly companyName: string;
  readonly url: string;
  readonly reason: string;
}

/** Consumo del LLM en la ejecución: permite estimar costo por job y por lead. */
export interface RunUsage {
  readonly llmCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AgentRunSummary {
  readonly jobId: string;
  readonly criteria: SearchCriteria;
  readonly savedLeads: readonly Lead[];
  readonly discarded: readonly DiscardedCandidate[];
  readonly iterations: number;
  readonly stopReason: StopReason;
  /** Último mensaje de texto del LLM (su propio resumen), si lo hubo. */
  readonly finalMessage: string | null;
  /** Motivo del corte cuando `stopReason` es `llm_error`; los leads ya guardados se conservan. */
  readonly error: string | null;
  readonly usage: RunUsage;
}
