import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { LlmProviderError } from '../../core/domain/errors/llm-provider.error.js';
import type {
  LLMProvider,
  LlmCompletion,
  LlmCompletionRequest,
} from '../../core/ports/llm-provider.js';
import { describeError } from '../shared/describe-error.js';
import {
  fromAnthropicMessage,
  toAnthropicRequest,
  toAnthropicTool,
} from './anthropic-message.mapper.js';

export type BedrockEffort = 'low' | 'medium' | 'high';

export interface BedrockProviderOptions {
  readonly region: string;
  /** ID de Claude en Bedrock, con prefijo `anthropic.` (p. ej. `anthropic.claude-haiku-5-5`). */
  readonly model: string;
  readonly effort: BedrockEffort;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

// Motivos de corte en los que la respuesta no es utilizable por el agente.
const UNUSABLE_STOP_REASONS: ReadonlySet<string> = new Set([
  'refusal',
  'max_tokens',
  'model_context_window_exceeded',
]);

/**
 * Claude vía Amazon Bedrock (endpoint `bedrock-mantle`, Messages API). Autenticación con la
 * cadena estándar de credenciales de AWS (perfil, `aws login`, rol IAM en Lambda): sin API
 * keys que gestionar. Los modelos actuales de Claude no aceptan `temperature`; la
 * consistencia se controla con `effort` y con las reglas del prompt.
 */
export class BedrockProvider implements LLMProvider {
  private readonly client: AnthropicBedrockMantle;

  constructor(private readonly options: BedrockProviderOptions) {
    this.client = new AnthropicBedrockMantle({
      awsRegion: options.region,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
  }

  async complete({ messages, tools }: LlmCompletionRequest): Promise<LlmCompletion> {
    const { system, messages: history } = toAnthropicRequest(messages);
    const response = await this.send({
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      system,
      messages: history,
      tools: tools.map(toAnthropicTool),
      tool_choice: { type: 'auto' },
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: this.options.effort },
    });

    if (response.stop_reason && UNUSABLE_STOP_REASONS.has(response.stop_reason)) {
      throw new LlmProviderError(`Bedrock: respuesta no utilizable (${response.stop_reason}).`);
    }
    const { usage } = response;
    return {
      ...fromAnthropicMessage(response),
      // La entrada cacheada también es entrada procesada (se factura con descuento).
      usage: {
        inputTokens:
          usage.input_tokens +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens,
      },
    };
  }

  private async send(params: Anthropic.MessageCreateParamsNonStreaming) {
    try {
      return await this.client.messages.create(params);
    } catch (error) {
      throw new LlmProviderError(`Bedrock: ${describeError(error)}`, { cause: error });
    }
  }
}
