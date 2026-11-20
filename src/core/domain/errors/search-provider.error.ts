import { DomainError } from './domain-error.js';

/** Error de servicio externo ya traducido por el adaptador. */
export class SearchProviderError extends DomainError {
  readonly code = 'SEARCH_PROVIDER_ERROR';
}
