import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../core/domain/errors/domain-error.js';
import { InvalidSearchCriteriaError } from '../../core/domain/errors/invalid-search-criteria.error.js';
import { LlmProviderError } from '../../core/domain/errors/llm-provider.error.js';
import { PageFetchError } from '../../core/domain/errors/page-fetch.error.js';
import { PersistenceError } from '../../core/domain/errors/persistence.error.js';
import { SearchProviderError } from '../../core/domain/errors/search-provider.error.js';

/** Traducción de errores de dominio a HTTP: el núcleo no conoce códigos de estado. */
export function httpStatusFor(error: DomainError): HttpStatus {
  if (error instanceof InvalidSearchCriteriaError) return HttpStatus.BAD_REQUEST;
  if (
    error instanceof LlmProviderError ||
    error instanceof SearchProviderError ||
    error instanceof PageFetchError
  ) {
    return HttpStatus.BAD_GATEWAY;
  }
  if (error instanceof PersistenceError) return HttpStatus.SERVICE_UNAVAILABLE;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = httpStatusFor(error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code: error.code, message: error.message });
  }
}
