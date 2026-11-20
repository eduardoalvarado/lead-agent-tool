import type { LLMProvider } from '../../core/ports/llm-provider.js';
import { BedrockProvider } from '../../infrastructure/llm/bedrock-provider.js';
import {
  OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
} from '../../infrastructure/llm/openai-compatible-provider.js';
import type { AppConfig } from '../config/app-config.js';

export interface LlmAdapterRegistration {
  readonly create: (config: AppConfig) => LLMProvider;
  /**
   * Si el agente debe compactar observaciones antiguas del historial: útil con límites
   * bajos de tokens (Groq free tier) o contextos cortos (modelos locales); desactivado con
   * modelos que exigen el historial intacto (thinking preservado de Claude).
   */
  readonly compactObservations: boolean;
}

export interface OpenAICompatiblePreset {
  readonly baseURL?: string;
  readonly model?: string;
  readonly apiKey?: string;
  readonly reasoningEffort?: AppConfig['LLM_REASONING_EFFORT'];
  readonly temperature?: number;
  readonly extraParams?: Readonly<Record<string, unknown>>;
}

/** Combina el preset con la configuración: las variables `LLM_*` sobrescriben los defaults. */
export function resolveOpenAICompatibleOptions(
  config: AppConfig,
  preset: OpenAICompatiblePreset,
): OpenAICompatibleProviderOptions {
  const reasoningEffort = config.LLM_REASONING_EFFORT ?? preset.reasoningEffort;
  const temperature = config.LLM_TEMPERATURE ?? preset.temperature;
  const extraParams = {
    ...preset.extraParams,
    ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
  };
  return {
    baseURL: config.LLM_BASE_URL ?? preset.baseURL ?? '',
    model: config.LLM_MODEL ?? preset.model ?? '',
    apiKey: config.LLM_API_KEY ?? preset.apiKey ?? '',
    timeoutMs: config.LLM_TIMEOUT_MS,
    maxRetries: config.LLM_MAX_RETRIES,
    ...(temperature !== undefined && { temperature }),
    ...(Object.keys(extraParams).length > 0 && { extraParams }),
  };
}

function openAICompatible(preset: OpenAICompatiblePreset): LlmAdapterRegistration {
  return {
    compactObservations: true,
    create: (config) =>
      new OpenAICompatibleProvider(resolveOpenAICompatibleOptions(config, preset)),
  };
}

/**
 * Registro de proveedores de LLM. El núcleo solo conoce el puerto `LLMProvider`:
 * conectar otro LLM es agregar un preset (si su API es compatible con OpenAI) o
 * implementar un adaptador nuevo, y registrarlo aquí y en `LLM_PROVIDERS`.
 */
export const LLM_ADAPTERS: Readonly<Record<AppConfig['LLM_PROVIDER'], LlmAdapterRegistration>> = {
  groq: openAICompatible({
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    // Temperatura 0: extracción determinista, menos variación y menos alucinación.
    temperature: 0,
    // Razonamiento corto: menos tokens por paso (cuentan para los límites del free tier).
    reasoningEffort: 'low',
    // Extensiones de Groq: razonamiento visible en los logs y tool calls en paralelo.
    extraParams: { include_reasoning: true, parallel_tool_calls: true },
  }),
  ollama: openAICompatible({
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen3:8b',
    temperature: 0,
    // Ollama no valida la key, pero el cliente exige una.
    apiKey: 'ollama',
  }),
  // Sin defaults: URL, modelo, key y (opcional) temperatura vienen de la configuración.
  'openai-compatible': openAICompatible({}),
  bedrock: {
    compactObservations: false,
    create: (config) =>
      new BedrockProvider({
        region: config.AWS_REGION,
        model: config.BEDROCK_MODEL,
        effort: config.BEDROCK_EFFORT,
        maxTokens: config.BEDROCK_MAX_TOKENS,
        timeoutMs: config.LLM_TIMEOUT_MS,
        maxRetries: config.LLM_MAX_RETRIES,
      }),
  },
};
