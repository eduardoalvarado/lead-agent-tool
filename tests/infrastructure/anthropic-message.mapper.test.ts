import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../src/core/ports/llm-provider.js';
import {
  fromAnthropicMessage,
  toAnthropicRequest,
} from '../../src/infrastructure/llm/anthropic-message.mapper.js';

const thinkingBlock = { type: 'thinking', thinking: 'Busco primero.', signature: 'sig' };
const toolUseBlock = { type: 'tool_use', id: 't1', name: 'search_web', input: { query: 'x' } };

describe('Anthropic message mapper', () => {
  it('separa el system y agrupa resultados de tools consecutivos en un único mensaje user', () => {
    const history: ChatMessage[] = [
      { role: 'system', content: 'Reglas' },
      { role: 'user', content: 'Sector: X' },
      {
        role: 'assistant',
        content: null,
        toolCalls: [
          { id: 't1', name: 'save_lead', arguments: '{}' },
          { id: 't2', name: 'discard_lead', arguments: '{}' },
        ],
      },
      { role: 'tool', toolCallId: 't1', content: 'GUARDADO' },
      { role: 'tool', toolCallId: 't2', content: 'DESCARTE' },
    ];

    const { system, messages } = toAnthropicRequest(history);

    expect(system).toBe('Reglas');
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'GUARDADO' },
        { type: 'tool_result', tool_use_id: 't2', content: 'DESCARTE' },
      ],
    });
  });

  it('devuelve intactos los bloques originales del assistant (thinking incluido)', () => {
    const original = [thinkingBlock, toolUseBlock];
    const { messages } = toAnthropicRequest([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: null, toolCalls: [], providerState: original },
    ]);

    expect(messages[1]).toEqual({ role: 'assistant', content: original });
  });

  it('extrae texto, razonamiento y tool calls de la respuesta', () => {
    const response = {
      content: [thinkingBlock, { type: 'text', text: 'Voy a buscar.' }, toolUseBlock],
    } as unknown as Anthropic.Message;

    expect(fromAnthropicMessage(response)).toEqual({
      content: 'Voy a buscar.',
      reasoning: 'Busco primero.',
      toolCalls: [{ id: 't1', name: 'search_web', arguments: '{"query":"x"}' }],
      providerState: response.content,
    });
  });
});
