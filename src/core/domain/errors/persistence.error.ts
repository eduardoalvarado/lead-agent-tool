import { DomainError } from './domain-error.js';

/** Error de servicio externo ya traducido por el adaptador. */
export class PersistenceError extends DomainError {
  readonly code = 'PERSISTENCE_ERROR';
}
