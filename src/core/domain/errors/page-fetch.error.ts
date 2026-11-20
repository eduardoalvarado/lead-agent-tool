import { DomainError } from './domain-error.js';

/** Error de servicio externo ya traducido por el adaptador. */
export class PageFetchError extends DomainError {
  readonly code = 'PAGE_FETCH_ERROR';
}
