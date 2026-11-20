import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { ProcessSearchJobUseCase } from '../core/application/process-search-job.use-case.js';
import { JobMessageSchema } from '../core/domain/job.js';
import { AppModule } from './app.module.js';
import { prepareEnvironment } from './config/app-config.js';
import { PROCESS_SEARCH_JOB_USE_CASE } from './providers/tokens.js';

// Handler del worker (Lambda disparada por SQS): mismo módulo Nest y mismo agente que la API,
// sin servidor HTTP. El contexto se crea una vez por contenedor (cold start).
let processor: ProcessSearchJobUseCase | undefined;

async function bootstrap(): Promise<ProcessSearchJobUseCase> {
  await prepareEnvironment();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  return app.get<ProcessSearchJobUseCase>(PROCESS_SEARCH_JOB_USE_CASE);
}

/** Procesa el lote; los mensajes que fallan vuelven a la cola (reintento y, luego, DLQ). */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  processor ??= await bootstrap();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      // eslint-disable-next-line no-await-in-loop -- lote de 1 mensaje (BatchSize 1)
      await processor.execute(JobMessageSchema.parse(JSON.parse(record.body)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `${JSON.stringify({ level: 'error', messageId: record.messageId, reason })}\n`,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
