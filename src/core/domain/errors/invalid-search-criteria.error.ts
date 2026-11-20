import { DomainError } from './domain-error.js';

export class InvalidSearchCriteriaError extends DomainError {
  readonly code = 'INVALID_SEARCH_CRITERIA';
}
