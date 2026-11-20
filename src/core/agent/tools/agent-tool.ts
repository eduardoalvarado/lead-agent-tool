import type { CandidateLedger } from '../candidate-ledger.js';
import type { DiscardedCandidate } from '../../domain/run-summary.js';
import type { Lead } from '../../domain/lead.js';
import type { SearchCriteria } from '../../domain/search-criteria.js';
import type { ToolDefinition } from '../../ports/llm-provider.js';

/** Contexto de la ejecución que el código (no el LLM) aporta a cada tool. */
export interface ToolExecutionContext {
  readonly criteria: SearchCriteria;
  readonly jobId: string;
  /** Memoria de la ejecución: candidatos vistos y decididos. */
  readonly ledger: CandidateLedger;
}

/** Efecto del tool sobre el resultado de la ejecución, para el resumen final. */
export type ToolOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'saved'; readonly lead: Lead }
  | { readonly kind: 'discarded'; readonly candidate: DiscardedCandidate };

export interface ToolResult {
  /** Texto que vuelve al LLM como resultado del tool. */
  readonly output: string;
  readonly outcome: ToolOutcome;
}

export interface AgentTool {
  readonly definition: ToolDefinition;
  execute(args: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

export const NO_OUTCOME: ToolOutcome = { kind: 'none' };
