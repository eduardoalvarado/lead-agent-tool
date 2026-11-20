import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;
const SWAGGER_PATH = 'docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lead Agent API')
    .setDescription('Agente IA para extracción y cualificación de leads B2B')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, () => SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(Number(process.env.PORT ?? DEFAULT_PORT));
}

await bootstrap();
