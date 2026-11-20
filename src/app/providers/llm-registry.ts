import type { LLMProvider } from '../../core/ports/llm-provider.js';
import { BedrockProvider } from '../../infrastructure/llm/bedrock-provider.js';
import { GroqProvider } from '../../infrastructure/llm/groq-provider.js';
import type { AppConfig } from '../config/app-config.js';

export interface LlmAdapterRegistration {
  readonly create: (config: AppConfig) => LLMProvider;
  /**
   * Si el agente debe compactar observaciones antiguas del historial: útil con límites
   * bajos de tokens por minuto; desactivado con modelos que exigen el historial intacto.
   */
  readonly compactObservations: boolean;
}

/**
 * Registro de proveedores de LLM. El núcleo solo conoce el puerto `LLMProvider`:
 * conectar otro LLM es implementar un adaptador y agregar una entrada aquí (y su
 * nombre al enum `LLM_PROVIDER` de la configuración).
 */
export const LLM_ADAPTERS: Readonly<Record<AppConfig['LLM_PROVIDER'], LlmAdapterRegistration>> = {
  groq: {
    compactObservations: true,
    create: (config) =>
      new GroqProvider({
        apiKey: config.GROQ_API_KEY ?? '',
        model: config.GROQ_MODEL,
        timeoutMs: config.LLM_TIMEOUT_MS,
        maxRetries: config.LLM_MAX_RETRIES,
      }),
  },
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
