/** Definición de un tool tal como se le presenta al LLM (parámetros en JSON Schema). */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** JSON crudo generado por el LLM; el agente lo parsea y valida. */
  readonly arguments: string;
}

export type ChatMessage =
  | { readonly role: 'system'; readonly content: string }
  | { readonly role: 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly toolCalls: readonly ToolCall[];
      /** Estado opaco del proveedor (p. ej. bloques de thinking) que debe volver intacto. */
      readonly providerState?: unknown;
    }
  | { readonly role: 'tool'; readonly toolCallId: string; readonly content: string };

export interface LlmCompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ToolDefinition[];
}

export interface LlmCompletion {
  readonly content: string | null;
  /** Razonamiento interno del modelo (modelos de razonamiento); solo para trazabilidad. */
  readonly reasoning: string | null;
  readonly toolCalls: readonly ToolCall[];
  /** Estado opaco que el adaptador necesita recibir de vuelta en el historial. El núcleo no lo interpreta. */
  readonly providerState?: unknown;
}

/** Puerto del LLM. Temperatura, modelo y timeout son responsabilidad del adaptador. */
export interface LLMProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}
