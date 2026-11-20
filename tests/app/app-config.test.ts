import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../../src/app/config/app-config.js';

describe('loadAppConfig', () => {
  it('aplica defaults y convierte números', () => {
    const config = loadAppConfig({ GROQ_API_KEY: 'k', AGENT_MAX_LEADS: '5' });

    expect(config).toMatchObject({
      LLM_PROVIDER: 'groq',
      SEARCH_PROVIDER: 'mock',
      AGENT_MAX_ITERATIONS: 20,
      AGENT_MAX_LEADS: 5,
    });
  });

  it('trata las variables vacías como ausentes', () => {
    expect(() => loadAppConfig({ GROQ_API_KEY: '' })).toThrow(/GROQ_API_KEY/);
  });

  it('exige la key de Tavily solo cuando se usa Tavily', () => {
    expect(() => loadAppConfig({ GROQ_API_KEY: 'k', SEARCH_PROVIDER: 'tavily' })).toThrow(
      /TAVILY_API_KEY/,
    );
  });

  it('no exige la key de Groq si el proveedor es Bedrock', () => {
    expect(loadAppConfig({ LLM_PROVIDER: 'bedrock' }).BEDROCK_MODEL).toBe(
      'anthropic.claude-haiku-5-5',
    );
  });

  it('rechaza un proveedor desconocido', () => {
    expect(() => loadAppConfig({ LLM_PROVIDER: 'otro' })).toThrow(/Configuración inválida/);
  });
});
