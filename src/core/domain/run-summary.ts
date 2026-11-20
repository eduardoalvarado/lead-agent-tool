import type { Lead } from './lead.js';
import type { SearchCriteria } from './search-criteria.js';

/** Por qué terminó el agente: por decisión propia o por una guarda. */
export type StopReason = 'completed' | 'max_iterations' | 'max_leads' | 'llm_error';

export interface DiscardedCandidate {
  readonly companyName: string;
  readonly url: string;
  readonly reason: string;
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
}
