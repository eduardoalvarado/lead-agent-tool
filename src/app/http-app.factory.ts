import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './common/domain-exception.filter.js';
import { loadDotEnvIfPresent } from './config/app-config.js';

const SWAGGER_PATH = 'docs';

/** Aplicación HTTP compartida por el servidor local (`main.ts`) y el handler Lambda. */
export async function createHttpApp(): Promise<NestExpressApplication> {
  loadDotEnvIfPresent();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new DomainExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lead Agent API')
    .setDescription(
      'Agente IA que busca empresas por sector y ubicación, extrae y cualifica sus datos con un LLM y los guarda en DynamoDB.',
    )
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, () => SwaggerModule.createDocument(app, swaggerConfig));
  return app;
}
