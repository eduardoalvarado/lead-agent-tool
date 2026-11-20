import type Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  LlmCompletion,
  ToolCall,
  ToolDefinition,
} from '../../core/ports/llm-provider.js';

// Traducción entre el modelo de mensajes del núcleo y la Messages API de Claude.

export interface AnthropicRequestParts {
  readonly system: string;
  readonly messages: Anthropic.MessageParam[];
}

function isContentBlocks(value: unknown): value is Anthropic.ContentBlockParam[] {
  return Array.isArray(value);
}

function assistantContent(
  message: Extract<ChatMessage, { role: 'assistant' }>,
): Anthropic.ContentBlockParam[] {
  // Los bloques originales (incluidos los de thinking) vuelven intactos: Claude los exige
  // sin modificar para continuar su razonamiento entre llamadas a tools.
  if (isContentBlocks(message.providerState)) return message.providerState;
  return [
    ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
    ...message.toolCalls.map((call) => ({
      type: 'tool_use' as const,
      id: call.id,
      name: call.name,
      input: JSON.parse(call.arguments || '{}') as Record<string, unknown>,
    })),
  ];
}

/**
 * Convierte el historial del núcleo: los mensajes `system` van al campo `system` y los
 * resultados de tools consecutivos se agrupan en UN mensaje `user` (requisito de Claude
 * para tool calls paralelos).
 */
export function toAnthropicRequest(history: readonly ChatMessage[]): AnthropicRequestParts {
  const system: string[] = [];
  const messages: Anthropic.MessageParam[] = [];

  history.forEach((message) => {
    if (message.role === 'system') {
      system.push(message.content);
    } else if (message.role === 'user') {
      messages.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant') {
      messages.push({ role: 'assistant', content: assistantContent(message) });
    } else {
      const result: Anthropic.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
      };
      const previous = messages.at(-1);
      if (previous?.role === 'user' && Array.isArray(previous.content)) {
        previous.content.push(result);
      } else {
        messages.push({ role: 'user', content: [result] });
      }
    }
  });

  return { system: system.join('\n\n'), messages };
}

export function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool.InputSchema,
  };
}

export function fromAnthropicMessage(message: Anthropic.Message): LlmCompletion {
  const text: string[] = [];
  const reasoning: string[] = [];
  const toolCalls: ToolCall[] = [];

  message.content.forEach((block) => {
    if (block.type === 'text') text.push(block.text);
    if (block.type === 'thinking' && block.thinking) reasoning.push(block.thinking);
    if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input) });
    }
  });

  return {
    content: text.length > 0 ? text.join('\n') : null,
    reasoning: reasoning.length > 0 ? reasoning.join('\n') : null,
    toolCalls,
    providerState: message.content,
  };
}
