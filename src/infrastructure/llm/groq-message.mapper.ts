import type Groq from 'groq-sdk';
import type { ChatMessage, ToolCall, ToolDefinition } from '../../core/ports/llm-provider.js';

type GroqMessage = Groq.Chat.ChatCompletionMessageParam;
type GroqTool = Groq.Chat.ChatCompletionTool;
type GroqToolCall = Groq.Chat.ChatCompletionMessageToolCall;

// Traducción entre el modelo de mensajes del núcleo y el formato OpenAI-compatible de Groq.

export function toGroqMessage(message: ChatMessage): GroqMessage {
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

export function toGroqTool(tool: ToolDefinition): GroqTool {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

export function fromGroqToolCall(call: GroqToolCall): ToolCall {
  return { id: call.id, name: call.function.name, arguments: call.function.arguments };
}
