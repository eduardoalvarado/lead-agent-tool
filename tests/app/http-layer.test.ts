import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { httpStatusFor } from '../../src/app/common/domain-exception.filter.js';
import { ZodValidationPipe } from '../../src/app/common/zod-validation.pipe.js';
import { loadAppConfig } from '../../src/app/config/app-config.js';
import { LLM_ADAPTERS } from '../../src/app/providers/llm-registry.js';
import { InvalidSearchCriteriaError } from '../../src/core/domain/errors/invalid-search-criteria.error.js';
import { LlmProviderError } from '../../src/core/domain/errors/llm-provider.error.js';
import { PersistenceError } from '../../src/core/domain/errors/persistence.error.js';
import { SearchCriteriaSchema } from '../../src/core/domain/search-criteria.js';
import { BedrockProvider } from '../../src/infrastructure/llm/bedrock-provider.js';
import { OpenAICompatibleProvider } from '../../src/infrastructure/llm/openai-compatible-provider.js';

describe('httpStatusFor', () => {
  it.each([
    [new InvalidSearchCriteriaError('x'), HttpStatus.BAD_REQUEST],
    [new LlmProviderError('x'), HttpStatus.BAD_GATEWAY],
    [new PersistenceError('x'), HttpStatus.SERVICE_UNAVAILABLE],
  ])('traduce %s', (error, status) => {
    expect(httpStatusFor(error)).toBe(status);
  });
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(SearchCriteriaSchema);

  it('devuelve los datos normalizados', () => {
    expect(pipe.transform({ sector: ' Dentistas ', location: 'Lima' })).toEqual({
      sector: 'Dentistas',
      location: 'Lima',
    });
  });

  it('lanza 400 con el detalle de los errores', () => {
    expect(() => pipe.transform({ sector: 'x' })).toThrow(BadRequestException);
  });
});

describe('LLM_ADAPTERS', () => {
  it('crea el adaptador elegido en la configuración', () => {
    const groq = loadAppConfig({ LLM_API_KEY: 'k' });
    const ollama = loadAppConfig({ LLM_PROVIDER: 'ollama' });
    const bedrock = loadAppConfig({ LLM_PROVIDER: 'bedrock' });

    expect(LLM_ADAPTERS.groq.create(groq)).toBeInstanceOf(OpenAICompatibleProvider);
    expect(LLM_ADAPTERS.ollama.create(ollama)).toBeInstanceOf(OpenAICompatibleProvider);
    expect(LLM_ADAPTERS.bedrock.create(bedrock)).toBeInstanceOf(BedrockProvider);
  });

  it('solo compacta el historial con proveedores que lo toleran', () => {
    expect(LLM_ADAPTERS.groq.compactObservations).toBe(true);
    expect(LLM_ADAPTERS.bedrock.compactObservations).toBe(false);
  });
});
