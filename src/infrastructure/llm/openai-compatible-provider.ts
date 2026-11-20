import OpenAI from 'openai';
import { LlmProviderError } from '../../core/domain/errors/llm-provider.error.js';
import type {
  LLMProvider,
  LlmCompletion,
  LlmCompletionRequest,
} from '../../core/ports/llm-provider.js';
import { describeError } from '../shared/describe-error.js';
import {
  extractReasoning,
  fromApiToolCalls,
  toApiMessage,
  toApiTool,
} from './openai-message.mapper.js';

export interface OpenAICompatibleProviderOptions {
  /** URL base de la API compatible (p. ej. https://api.groq.com/openai/v1). */
  readonly baseURL: string;
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  /** Parámetros propios del proveedor (p. ej. `include_reasoning` en Groq). */
  readonly extraParams?: Readonly<Record<string, unknown>>;
}

// Temperatura 0: extracción determinista, menos variación y menos alucinación.
const TEMPERATURE = 0;

/**
 * Cualquier LLM con API compatible con OpenAI Chat Completions + tool calling:
 * Groq, Ollama (local), OpenRouter, Gemini, Cerebras, vLLM… Se elige por configuración.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(private readonly options: OpenAICompatibleProviderOptions) {
    this.client = new OpenAI({
      baseURL: options.baseURL,
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
  }

  async complete({ messages, tools }: LlmCompletionRequest): Promise<LlmCompletion> {
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      ...this.options.extraParams,
      model: this.options.model,
      temperature: TEMPERATURE,
      messages: messages.map(toApiMessage),
      tools: tools.map(toApiTool),
      tool_choice: 'auto',
    };
    const response = await this.client.chat.completions.create(params).catch((error: unknown) => {
      throw new LlmProviderError(`LLM (${this.options.model}): ${describeError(error)}`, {
        cause: error,
      });
    });

    const message = response.choices[0]?.message;
    if (!message) throw new LlmProviderError('El LLM devolvió una respuesta sin mensaje.');
    return {
      content: message.content ?? null,
      reasoning: extractReasoning(message),
      toolCalls: fromApiToolCalls(message.tool_calls),
      ...(response.usage && {
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        },
      }),
    };
  }
}
