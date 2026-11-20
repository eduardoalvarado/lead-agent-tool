import { DomainError } from './domain-error.js';

/** Error de servicio externo ya traducido por el adaptador. */
export class LlmProviderError extends DomainError {
  readonly code = 'LLM_PROVIDER_ERROR';
}
