import type { Context, SQSRecord } from 'aws-lambda';
import type { JobAttempt } from '../../core/application/process-search-job.use-case.js';
import type { AppConfig } from '../config/app-config.js';

// Tiempo reservado para guardar el resultado del job después de que vence el plazo del agente.
const PERSISTENCE_MARGIN_MS = 10_000;

/**
 * Margen antes del timeout de la Lambda: el agente solo revisa el plazo entre pasos, así que
 * hay que dejar tiempo para el peor caso de un paso en curso (una llamada al LLM con todos sus
 * reintentos y la lectura de una página) y para guardar el resultado. Si la Lambda muriera
 * por timeout, el job quedaría en `running` sin pasar por ningún catch.
 */
export function shutdownMarginMs(config: AppConfig): number {
  const worstLlmCallMs = config.LLM_TIMEOUT_MS * (config.LLM_MAX_RETRIES + 1);
  return worstLlmCallMs + config.HTTP_TIMEOUT_MS + PERSISTENCE_MARGIN_MS;
}

/** Traduce la entrega de SQS y el tiempo restante de la invocación al contexto del caso de uso. */
export function jobAttemptFrom(
  record: SQSRecord,
  context: Pick<Context, 'getRemainingTimeInMillis'>,
  config: AppConfig,
): JobAttempt {
  const receiveCount = Number(record.attributes.ApproximateReceiveCount);
  const agentBudgetMs = Math.max(0, context.getRemainingTimeInMillis() - shutdownMarginMs(config));
  return {
    finalAttempt: receiveCount >= config.JOBS_MAX_ATTEMPTS,
    deadline: AbortSignal.timeout(agentBudgetMs),
  };
}
