import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../../src/app/config/app-config.js';

describe('loadAppConfig', () => {
  it('aplica defaults y convierte números', () => {
    const config = loadAppConfig({ LLM_API_KEY: 'k', AGENT_MAX_LEADS: '5' });

    expect(config).toMatchObject({
      LLM_PROVIDER: 'groq',
      SEARCH_PROVIDER: 'mock',
      AGENT_MAX_ITERATIONS: 20,
      AGENT_MAX_LEADS: 5,
    });
  });

  it('trata las variables vacías como ausentes', () => {
    expect(() => loadAppConfig({ LLM_API_KEY: '' })).toThrow(/LLM_API_KEY/);
  });

  it('no exige key con Ollama local', () => {
    expect(loadAppConfig({ LLM_PROVIDER: 'ollama' }).LLM_PROVIDER).toBe('ollama');
  });

  it('exige URL base y modelo con openai-compatible', () => {
    expect(() => loadAppConfig({ LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: 'k' })).toThrow(
      /LLM_BASE_URL/,
    );
  });

  it('exige la key de Tavily solo cuando se usa Tavily', () => {
    expect(() => loadAppConfig({ LLM_API_KEY: 'k', SEARCH_PROVIDER: 'tavily' })).toThrow(
      /TAVILY_API_KEY/,
    );
  });

  it('no exige la key del LLM si el proveedor es Bedrock', () => {
    expect(loadAppConfig({ LLM_PROVIDER: 'bedrock' }).BEDROCK_MODEL).toBe(
      'anthropic.claude-haiku-5-5',
    );
  });

  it('rechaza un proveedor desconocido', () => {
    expect(() => loadAppConfig({ LLM_PROVIDER: 'otro' })).toThrow(/Configuración inválida/);
  });
});
