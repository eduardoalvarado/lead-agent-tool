import type OpenAI from 'openai';
import type { ChatMessage, ToolCall, ToolDefinition } from '../../core/ports/llm-provider.js';

type ApiMessage = OpenAI.Chat.ChatCompletionMessageParam;
type ApiTool = OpenAI.Chat.ChatCompletionFunctionTool;
type ApiToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

// Traducción entre el modelo de mensajes del núcleo y la Chat Completions API de OpenAI,
// que también exponen Groq, Ollama, OpenRouter, Gemini y otros proveedores compatibles.

export function toApiMessage(message: ChatMessage): ApiMessage {
  switch (message.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls.length > 0 && {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
      };
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    default:
      return { role: message.role, content: message.content };
  }
}

export function toApiTool(tool: ToolDefinition): ApiTool {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

/** Solo tool calls de tipo función (los "custom tools" de OpenAI no se usan aquí). */
export function fromApiToolCalls(calls: readonly ApiToolCall[] | undefined): ToolCall[] {
  return (calls ?? []).flatMap((call) =>
    call.type === 'function'
      ? [{ id: call.id, name: call.function.name, arguments: call.function.arguments }]
      : [],
  );
}

/**
 * Razonamiento de modelos que lo exponen fuera del estándar: Groq usa `reasoning`;
 * Ollama, DeepSeek y otros, `reasoning_content`.
 */
export function extractReasoning(message: object): string | null {
  const { reasoning, reasoning_content: reasoningContent } = message as {
    reasoning?: unknown;
    reasoning_content?: unknown;
  };
  const value = reasoning ?? reasoningContent;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
