import 'reflect-metadata';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import type { Context, Handler } from 'aws-lambda';
import { createHttpApp } from './http-app.factory.js';

// Handler para AWS Lambda detrás de API Gateway. La app Nest se crea una sola vez por
// contenedor (cold start) y se reutiliza en las invocaciones siguientes.
let cachedHandler: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await createHttpApp();
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

export const handler: Handler = async (event: unknown, context: Context, callback) => {
  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, callback);
};
