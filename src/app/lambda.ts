import 'reflect-metadata';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createHttpApp } from './http-app.factory.js';

// Handler para AWS Lambda detrás de API Gateway. La app Nest se crea una sola vez por
// contenedor (cold start) y se reutiliza en las invocaciones siguientes.
type ExpressHandler = ReturnType<typeof serverlessExpress>;
let cachedHandler: ExpressHandler | undefined;

async function bootstrap(): Promise<ExpressHandler> {
  const app = await createHttpApp();
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

/**
 * Handler async con 2 parámetros: el runtime Node.js 24 de Lambda ya no admite handlers con
 * callback. serverless-express resuelve la respuesta como promesa.
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, () => undefined) as Promise<APIGatewayProxyResult>;
}
