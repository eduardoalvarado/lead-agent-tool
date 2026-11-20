import type { AgentRunSummary, StopReason } from '../domain/run-summary.js';
import { DomainError } from '../domain/errors/domain-error.js';
import { LlmProviderError } from '../domain/errors/llm-provider.error.js';
import type { SearchCriteria } from '../domain/search-criteria.js';
import type {
  LLMProvider,
  LlmCompletion,
  ToolCall,
  ToolDefinition,
} from '../ports/llm-provider.js';
import type { Logger } from '../ports/logger.js';
import { AgentRun } from './agent-run.js';
import { CandidateLedger } from './candidate-ledger.js';
import { buildIterationLimitNotice } from './prompts/iteration-limit-notice.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts/system-prompt.js';
import { type AgentTool, NO_OUTCOME, type ToolResult } from './tools/agent-tool.js';
import { truncate } from './tools/truncate.js';

export interface LeadAgentOptions {
  readonly maxIterations: number;
  readonly maxLeads: number;
  /** Resume observaciones antiguas del historial (ver `AgentRun`). Por defecto, no. */
  readonly compactObservations?: boolean;
}

const LOG_PREVIEW_CHARS = 300;

// Respuestas restantes en las que se avisa al LLM que debe cerrar lo pendiente.
const ITERATION_LIMIT_NOTICE_AT_REMAINING = 2;

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return undefined;
  }
}

/**
 * Agente ReAct sobre tool calling: en cada iteración el LLM razona y decide qué tool
 * usar (buscar, leer, guardar, descartar) o terminar respondiendo sin tools.
 * El código solo ejecuta, valida y aplica las guardas (iteraciones, leads máximos y plazo).
 */
export class LeadAgent {
  private readonly toolsByName: ReadonlyMap<string, AgentTool>;

  private readonly toolDefinitions: readonly ToolDefinition[];

  constructor(
    private readonly llm: LLMProvider,
    tools: readonly AgentTool[],
    private readonly logger: Logger,
    private readonly options: LeadAgentOptions,
  ) {
    this.toolsByName = new Map(tools.map((tool) => [tool.definition.name, tool]));
    this.toolDefinitions = tools.map((tool) => tool.definition);
  }

  /**
   * @param deadline Plazo opcional de la ejecución (p. ej. el timeout de la Lambda). Al abortarse,
   *   el agente corta antes de la siguiente llamada al LLM o a un tool, conservando lo avanzado.
   */
  async run(
    criteria: SearchCriteria,
    jobId: string,
    deadline?: AbortSignal,
  ): Promise<AgentRunSummary> {
    const run = new AgentRun(
      { criteria, jobId, ledger: new CandidateLedger() },
      [
        { role: 'system', content: buildSystemPrompt(this.options) },
        { role: 'user', content: buildUserPrompt(criteria.sector, criteria.location) },
      ],
      this.options.compactObservations ?? false,
    );
    this.logger.info('Agente iniciado', { jobId, ...criteria, ...this.options });

    const stopReason = await this.loop(run, deadline);
    const summary = run.summarize(stopReason);
    this.logger.info('Agente finalizado', {
      stopReason,
      iterations: summary.iterations,
      saved: summary.savedLeads.map((lead) => lead.id),
      discarded: summary.discarded,
      usage: summary.usage,
    });
    return summary;
  }

  private async loop(run: AgentRun, deadline?: AbortSignal): Promise<StopReason> {
    // Secuencial por diseño: cada paso del razonamiento depende del resultado del anterior.
    while (run.iteration < this.options.maxIterations) {
      if (deadline?.aborted) return 'time_limit';
      run.startIteration();
      // eslint-disable-next-line no-await-in-loop
      const completion = await this.complete(run);
      if (!completion) return 'llm_error';
      run.recordCompletion(completion);
      this.logThoughts(run.iteration, completion);
      if (completion.toolCalls.length === 0) return 'completed';

      // eslint-disable-next-line no-await-in-loop
      const guardStop = await this.executeToolCalls(completion.toolCalls, run, deadline);
      if (guardStop) return guardStop;
      this.warnIfNearIterationLimit(run);
    }
    return 'max_iterations';
  }

  /** Avisa una sola vez al LLM que se acerca el límite de iteraciones, para que cierre lo pendiente. */
  private warnIfNearIterationLimit(run: AgentRun): void {
    const remaining = this.options.maxIterations - run.iteration;
    if (remaining !== ITERATION_LIMIT_NOTICE_AT_REMAINING) return;
    run.recordNotice(buildIterationLimitNotice(remaining));
    this.logger.info(`[${run.iteration}] Aviso de límite de iteraciones`, { remaining });
  }

  /** Llama al LLM; si falla, registra el error y devuelve `null` para cortar con lo avanzado. */
  private async complete(run: AgentRun): Promise<LlmCompletion | null> {
    try {
      return await this.llm.complete({ messages: run.messages, tools: this.toolDefinitions });
    } catch (error) {
      if (!(error instanceof LlmProviderError)) throw error;
      this.logger.error('El LLM falló; se corta la ejecución conservando lo avanzado', {
        message: error.message,
      });
      run.recordFailure(error.message);
      return null;
    }
  }

  /** Ejecuta los tool calls en orden; devuelve la guarda que corta la ejecución, si alguna. */
  private async executeToolCalls(
    calls: readonly ToolCall[],
    run: AgentRun,
    deadline?: AbortSignal,
  ): Promise<StopReason | null> {
    for (const call of calls) {
      if (deadline?.aborted) return 'time_limit';
      // eslint-disable-next-line no-await-in-loop
      run.recordToolResult(call, await this.executeToolCall(call, run));
      if (run.savedCount >= this.options.maxLeads) return 'max_leads';
    }
    return null;
  }

  private async executeToolCall(call: ToolCall, run: AgentRun): Promise<ToolResult> {
    const tool = this.toolsByName.get(call.name);
    if (!tool) return this.toolError(call, `El tool "${call.name}" no existe.`);

    const args = parseArguments(call.arguments);
    if (args === undefined) {
      return this.toolError(call, 'Los argumentos no son JSON válido. Reintenta.');
    }

    this.logger.info(`[${run.iteration}] Tool → ${call.name}`, { args });
    try {
      const result = await tool.execute(args, run.context);
      this.logger.info(`[${run.iteration}] Resultado ← ${call.name}`, {
        outcome: result.outcome.kind,
        preview: truncate(result.output, LOG_PREVIEW_CHARS),
      });
      return result;
    } catch (error) {
      // Fallos esperables de servicios externos vuelven al LLM; los bugs se propagan.
      if (error instanceof DomainError) return this.toolError(call, error.message);
      throw error;
    }
  }

  private logThoughts(iteration: number, { reasoning, content }: LlmCompletion): void {
    if (reasoning) {
      this.logger.info(`[${iteration}] Razonamiento`, {
        reasoning: truncate(reasoning, LOG_PREVIEW_CHARS),
      });
    }
    if (content) this.logger.info(`[${iteration}] Mensaje`, { content });
  }

  private toolError(call: ToolCall, message: string): ToolResult {
    this.logger.warn(`Error en tool ${call.name}`, { message });
    return { output: `ERROR: ${message}`, outcome: NO_OUTCOME };
  }
}
