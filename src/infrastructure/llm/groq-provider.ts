import Groq from 'groq-sdk';
import { LlmProviderError } from '../../core/domain/errors/llm-provider.error.js';
import type {
  LLMProvider,
  LlmCompletion,
  LlmCompletionRequest,
} from '../../core/ports/llm-provider.js';
import { describeError } from '../shared/describe-error.js';
import { fromGroqToolCall, toGroqMessage, toGroqTool } from './groq-message.mapper.js';

export interface GroqProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

// Temperatura 0: extracción determinista, menos variación y menos alucinación.
const TEMPERATURE = 0;

export class GroqProvider implements LLMProvider {
  private readonly client: Groq;

  constructor(private readonly options: GroqProviderOptions) {
    this.client = new Groq({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
  }

  async complete({ messages, tools }: LlmCompletionRequest): Promise<LlmCompletion> {
    const response = await this.client.chat.completions
      .create({
        model: this.options.model,
        temperature: TEMPERATURE,
        messages: messages.map(toGroqMessage),
        tools: tools.map(toGroqTool),
        tool_choice: 'auto',
        parallel_tool_calls: true,
        include_reasoning: true,
      })
      .catch((error: unknown) => {
        throw new LlmProviderError(`Groq: ${describeError(error)}`, { cause: error });
      });

    const message = response.choices[0]?.message;
    if (!message) throw new LlmProviderError('Groq devolvió una respuesta sin mensaje.');
    return {
      content: message.content ?? null,
      reasoning: message.reasoning ?? null,
      toolCalls: (message.tool_calls ?? []).map(fromGroqToolCall),
    };
  }
}
