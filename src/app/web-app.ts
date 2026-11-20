import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';

// Interfaz web local: un HTML estático (public/index.html) servido por el mismo servidor que la
// API, así comparten origen y no hace falta CORS. Solo la sirve el servidor local (main.ts).
// La ruta es la misma desde src/app (tests) y desde dist/app (build).
export const WEB_APP_DIR = path.resolve(import.meta.dirname, '../../public');

export function serveWebApp(app: NestExpressApplication): void {
  app.useStaticAssets(WEB_APP_DIR);
}
