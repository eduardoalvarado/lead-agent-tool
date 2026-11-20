import type { SQSRecord } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../../src/app/config/app-config.js';
import { jobAttemptFrom, shutdownMarginMs } from '../../src/app/jobs/job-attempt.js';

const config = loadAppConfig({
  LLM_PROVIDER: 'ollama',
  LLM_TIMEOUT_MS: '60000',
  LLM_MAX_RETRIES: '2',
  HTTP_TIMEOUT_MS: '10000',
  JOBS_MAX_ATTEMPTS: '3',
});

function recordWithReceiveCount(count: number): SQSRecord {
  return { attributes: { ApproximateReceiveCount: String(count) } } as SQSRecord;
}

const remaining = (ms: number) => ({ getRemainingTimeInMillis: () => ms });

describe('jobAttemptFrom', () => {
  it('reserva el peor caso de un paso (LLM con reintentos + página) y el guardado', () => {
    expect(shutdownMarginMs(config)).toBe(60_000 * 3 + 10_000 + 10_000);
  });

  it.each([
    [1, false],
    [2, false],
    [3, true],
  ])('entrega %i de 3 → último intento: %s', (count, final) => {
    const attempt = jobAttemptFrom(recordWithReceiveCount(count), remaining(900_000), config);
    expect(attempt.finalAttempt).toBe(final);
    expect(attempt.deadline?.aborted).toBe(false);
  });

  it('si el tiempo restante no cubre el margen, el plazo ya está vencido', async () => {
    const attempt = jobAttemptFrom(recordWithReceiveCount(1), remaining(100_000), config);
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    expect(attempt.deadline?.aborted).toBe(true);
  });
});
