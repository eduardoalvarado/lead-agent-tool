import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { ProcessSearchJobUseCase } from '../core/application/process-search-job.use-case.js';
import { JobMessageSchema } from '../core/domain/job.js';
import { AppModule } from './app.module.js';
import { type AppConfig, prepareEnvironment } from './config/app-config.js';
import { jobAttemptFrom } from './jobs/job-attempt.js';
import { APP_CONFIG, PROCESS_SEARCH_JOB_USE_CASE } from './providers/tokens.js';

// Handler del worker (Lambda disparada por SQS): mismo módulo Nest y mismo agente que la API,
// sin servidor HTTP. El contexto se crea una vez por contenedor (cold start).
interface Worker {
  readonly processor: ProcessSearchJobUseCase;
  readonly config: AppConfig;
}

let worker: Worker | undefined;

async function bootstrap(): Promise<Worker> {
  await prepareEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  return {
    processor: app.get<ProcessSearchJobUseCase>(PROCESS_SEARCH_JOB_USE_CASE),
    config: app.get<AppConfig>(APP_CONFIG),
  };
}

/** Procesa el lote; los mensajes que fallan vuelven a la cola (reintento y, luego, DLQ). */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  worker ??= await bootstrap();
  const { processor, config } = worker;
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      const message = JobMessageSchema.parse(JSON.parse(record.body));
      // eslint-disable-next-line no-await-in-loop -- lote de 1 mensaje (BatchSize 1)
      await processor.execute(message, jobAttemptFrom(record, context, config));
    } catch (error) {
      // Escritura directa y no el puerto Logger: el error puede venir de un mensaje que ni
      // siquiera se pudo interpretar, antes de que el caso de uso intervenga.
      const reason = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `${JSON.stringify({ level: 'error', messageId: record.messageId, reason })}\n`,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
