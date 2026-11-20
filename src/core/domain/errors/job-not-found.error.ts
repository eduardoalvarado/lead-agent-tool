import { DomainError } from './domain-error.js';

export class JobNotFoundError extends DomainError {
  readonly code = 'JOB_NOT_FOUND';
}
