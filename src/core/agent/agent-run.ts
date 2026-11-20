import type { AgentRunSummary, DiscardedCandidate, StopReason } from '../domain/run-summary.js';
import type { Lead } from '../domain/lead.js';
import type { ChatMessage, LlmCompletion, ToolCall } from '../ports/llm-provider.js';
import type { ToolExecutionContext, ToolResult } from './tools/agent-tool.js';
import { truncate } from './tools/truncate.js';

// Compactación opcional: las observaciones antiguas se resumen para que el contexto no crezca
// sin límite (útil con proveedores de límites bajos de tokens por minuto). Las más recientes
// van completas: las guardas de los tools obligan a decidir sobre ellas antes de avanzar.
// Se desactiva con modelos que exigen el historial intacto (thinking preservado de Claude).
const RECENT_OBSERVATIONS_KEPT = 2;
const COMPACTED_OBSERVATION_CHARS = 500;

/** Estado de una ejecución del agente: historial de mensajes y leads guardados/descartados. */
export class AgentRun {
  private readonly history: ChatMessage[];

  private readonly savedLeads: Lead[] = [];

  private readonly discarded: DiscardedCandidate[] = [];

  private iterationCount = 0;

  private lastMessage: string | null = null;

  private failure: string | null = null;

  constructor(
    readonly context: ToolExecutionContext,
    initialMessages: readonly ChatMessage[],
    private readonly compactObservations: boolean,
  ) {
    this.history = [...initialMessages];
  }

  /** Historial a enviar al LLM (con las observaciones antiguas compactadas, si aplica). */
  get messages(): readonly ChatMessage[] {
    if (!this.compactObservations) return this.history;
    const toolIndexes = this.history.flatMap((message, index) =>
      message.role === 'tool' ? [index] : [],
    );
    const recent = new Set(toolIndexes.slice(-RECENT_OBSERVATIONS_KEPT));
    return this.history.map((message, index) =>
      message.role === 'tool' && !recent.has(index)
        ? { ...message, content: truncate(message.content, COMPACTED_OBSERVATION_CHARS) }
        : message,
    );
  }

  get iteration(): number {
    return this.iterationCount;
  }

  get savedCount(): number {
    return this.savedLeads.length;
  }

  startIteration(): void {
    this.iterationCount += 1;
  }

  recordCompletion(completion: LlmCompletion): void {
    this.history.push({
      role: 'assistant',
      content: completion.content,
      toolCalls: completion.toolCalls,
      providerState: completion.providerState,
    });
    if (completion.content) this.lastMessage = completion.content;
  }

  recordFailure(reason: string): void {
    this.failure = reason;
  }

  recordToolResult(call: ToolCall, { output, outcome }: ToolResult): void {
    this.history.push({ role: 'tool', toolCallId: call.id, content: output });
    if (outcome.kind === 'saved') this.savedLeads.push(outcome.lead);
    if (outcome.kind === 'discarded') this.discarded.push(outcome.candidate);
  }

  summarize(stopReason: StopReason): AgentRunSummary {
    return {
      jobId: this.context.jobId,
      criteria: this.context.criteria,
      savedLeads: [...this.savedLeads],
      discarded: [...this.discarded],
      iterations: this.iterationCount,
      stopReason,
      finalMessage: this.lastMessage,
      error: this.failure,
    };
  }
}
