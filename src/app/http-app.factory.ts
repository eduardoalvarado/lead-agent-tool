import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './common/domain-exception.filter.js';
import { type AppConfig, prepareEnvironment } from './config/app-config.js';
import { APP_CONFIG } from './providers/tokens.js';

const SWAGGER_PATH = 'docs';

/** Aplicación HTTP compartida por el servidor local (`main.ts`) y el handler Lambda. */
export async function createHttpApp(): Promise<INestApplication> {
  await prepareEnvironment();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new DomainExceptionFilter());

  const { CORS_ORIGINS } = app.get<AppConfig>(APP_CONFIG);
  if (CORS_ORIGINS) {
    app.enableCors({
      origin: CORS_ORIGINS.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lead Agent API')
    .setDescription(
      'Agente IA que busca empresas por sector y ubicación, extrae y cualifica sus datos con un LLM y los guarda en DynamoDB.',
    )
    .setVersion('0.1.0')
    // En AWS la API exige el token de Cognito (Authorization: Bearer <IdToken>).
    .addBearerAuth()
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, () => SwaggerModule.createDocument(app, swaggerConfig));
  return app;
}
