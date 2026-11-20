import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmProviderError } from '../../src/core/domain/errors/llm-provider.error.js';
import { PageFetchError } from '../../src/core/domain/errors/page-fetch.error.js';
import { SearchProviderError } from '../../src/core/domain/errors/search-provider.error.js';
import { HttpPageFetcher } from '../../src/infrastructure/fetch/http-page-fetcher.js';
import { BedrockProvider } from '../../src/infrastructure/llm/bedrock-provider.js';
import { OpenAICompatibleProvider } from '../../src/infrastructure/llm/openai-compatible-provider.js';
import { TavilyProvider } from '../../src/infrastructure/search/tavily-provider.js';

// Los SDKs externos se reemplazan: estos tests verifican el contrato del adaptador
// (mapeo de respuestas y traducción de errores a errores de dominio), no el SDK.
const sdk = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  bedrockCreate: vi.fn(),
  tavilySearch: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: sdk.chatCreate } };
  },
}));
vi.mock('@anthropic-ai/bedrock-sdk', () => ({
  AnthropicBedrockMantle: class {
    messages = { create: sdk.bedrockCreate };
  },
}));
vi.mock('@tavily/core', () => ({ tavily: () => ({ search: sdk.tavilySearch }) }));

const request = { messages: [{ role: 'user' as const, content: 'hola' }], tools: [] };

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('OpenAICompatibleProvider', () => {
  const llm = new OpenAICompatibleProvider({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: 'k',
    model: 'm',
    timeoutMs: 1,
    maxRetries: 0,
    temperature: 0,
    extraParams: { include_reasoning: true },
  });

  it('mapea texto, razonamiento y tool calls', async () => {
    sdk.chatCreate.mockReturnValue(
      Promise.resolve({
        choices: [
          {
            message: {
              content: null,
              reasoning: 'Busco.',
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'search_web', arguments: '{}' } },
              ],
            },
          },
        ],
      }),
    );

    expect(await llm.complete(request)).toEqual({
      content: null,
      reasoning: 'Busco.',
      toolCalls: [{ id: 'c1', name: 'search_web', arguments: '{}' }],
    });
  });

  it('traduce errores del SDK a LlmProviderError', async () => {
    sdk.chatCreate.mockReturnValue(Promise.reject(new Error('429 rate limit')));

    await expect(llm.complete(request)).rejects.toThrow(LlmProviderError);
  });

  it('informa los tokens consumidos', async () => {
    sdk.chatCreate.mockReturnValue(
      Promise.resolve({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1200, completion_tokens: 80 },
      }),
    );

    expect((await llm.complete(request)).usage).toEqual({ inputTokens: 1200, outputTokens: 80 });
  });

  it('envía temperatura 0, tool_choice auto y los parámetros propios del preset', async () => {
    sdk.chatCreate.mockReturnValue(Promise.resolve({ choices: [{ message: { content: 'ok' } }] }));

    await llm.complete(request);

    expect(sdk.chatCreate.mock.calls[0]?.[0]).toMatchObject({
      model: 'm',
      temperature: 0,
      tool_choice: 'auto',
      include_reasoning: true,
    });
  });
  it('no envía temperature si no está configurada (modelos que la rechazan)', async () => {
    const claude = new OpenAICompatibleProvider({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'k',
      model: 'anthropic/claude-haiku-5.5',
      timeoutMs: 1,
      maxRetries: 0,
    });
    sdk.chatCreate.mockReturnValue(Promise.resolve({ choices: [{ message: { content: 'ok' } }] }));

    await claude.complete(request);

    expect(sdk.chatCreate.mock.calls[0]?.[0]).not.toHaveProperty('temperature');
  });
});

describe('BedrockProvider', () => {
  const bedrock = new BedrockProvider({
    region: 'us-east-2',
    model: 'anthropic.claude-haiku-5-5',
    effort: 'medium',
    maxTokens: 1000,
    timeoutMs: 1,
    maxRetries: 0,
  });

  it('envía tool_choice auto, thinking adaptativo y effort; sin temperature', async () => {
    sdk.bedrockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Listo.' }],
      usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 100 },
    });

    const completion = await bedrock.complete(request);

    expect(completion.content).toBe('Listo.');
    expect(completion.usage).toEqual({ inputTokens: 1000, outputTokens: 40 });
    const params = sdk.bedrockCreate.mock.calls[0]?.[0];
    expect(params).toMatchObject({
      model: 'anthropic.claude-haiku-5-5',
      tool_choice: { type: 'auto' },
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
    });
    expect(params).not.toHaveProperty('temperature');
  });

  it.each(['refusal', 'max_tokens'])('trata stop_reason=%s como error', async (stopReason) => {
    sdk.bedrockCreate.mockResolvedValue({
      stop_reason: stopReason,
      content: [],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    await expect(bedrock.complete(request)).rejects.toThrow(LlmProviderError);
  });

  it('traduce errores del SDK a LlmProviderError', async () => {
    sdk.bedrockCreate.mockRejectedValue(new Error('403 not available for this account'));

    await expect(bedrock.complete(request)).rejects.toThrow(/Bedrock: 403/);
  });
});

describe('TavilyProvider', () => {
  const tavily = new TavilyProvider({ apiKey: 'k', timeoutMs: 1 });

  it('devuelve solo título, URL y contenido', async () => {
    sdk.tavilySearch.mockResolvedValue({
      results: [{ title: 'T', url: 'https://a.pe', content: 'C', score: 0.9, id: 'x' }],
    });

    expect(await tavily.search('dentistas Lima', 5)).toEqual([
      { title: 'T', url: 'https://a.pe', content: 'C' },
    ]);
  });

  it('traduce errores a SearchProviderError', async () => {
    sdk.tavilySearch.mockRejectedValue(new Error('401 invalid key'));

    await expect(tavily.search('dentistas Lima', 5)).rejects.toThrow(SearchProviderError);
  });
});

describe('HttpPageFetcher', () => {
  const fetcher = new HttpPageFetcher({ timeoutMs: 1000, userAgent: 'test' });
  const html = '<html><head><title>Contacto</title></head><body><p>Tel: 241-7788</p></body></html>';

  function stubFetch(response: Response | Error) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
      }),
    );
  }

  it('convierte HTML a texto con su título', async () => {
    stubFetch(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));

    expect(await fetcher.fetch('https://a.pe/contacto')).toEqual({
      url: 'https://a.pe/contacto',
      title: 'Contacto',
      text: 'Contacto\nTel: 241-7788',
    });
  });

  it.each([
    ['un estado HTTP de error', new Response('no', { status: 404 })],
    [
      'contenido no legible',
      new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    ],
    ['un fallo de red', new Error('ECONNREFUSED')],
  ])('lanza PageFetchError ante %s', async (_case, response) => {
    stubFetch(response);

    await expect(fetcher.fetch('https://a.pe')).rejects.toThrow(PageFetchError);
  });
});
