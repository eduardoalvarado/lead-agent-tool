import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AppConfig } from './config/app-config.js';
import { createHttpApp } from './http-app.factory.js';
import { APP_CONFIG } from './providers/tokens.js';

// El endpoint es síncrono en la PoC y una ejecución del agente puede tardar minutos:
// se amplía el timeout por defecto de Node (5 min) para no cortar la respuesta.
const AGENT_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

const app = await createHttpApp();
(app.getHttpServer() as Server).requestTimeout = AGENT_REQUEST_TIMEOUT_MS;
const { PORT } = app.get<AppConfig>(APP_CONFIG);
await app.listen(PORT);
process.stdout.write(
  `API en http://localhost:${PORT} · Swagger en http://localhost:${PORT}/docs\n`,
);
