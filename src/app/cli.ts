import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import type { SearchLeadsUseCase } from '../core/application/search-leads.use-case.js';
import { DomainError } from '../core/domain/errors/domain-error.js';
import { AppModule } from './app.module.js';
import { loadDotEnvIfPresent } from './config/app-config.js';
import { SEARCH_LEADS_USE_CASE } from './providers/tokens.js';

// CLI: mismo caso de uso que HTTP y Lambda, sin servidor (createApplicationContext).
// Uso: npm run agent -- --sector "Clínicas dentales" --location "Lima, Perú"
const { values } = parseArgs({
  options: {
    sector: { type: 'string' },
    location: { type: 'string' },
  },
});

loadDotEnvIfPresent();
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const summary = await app
    .get<SearchLeadsUseCase>(SEARCH_LEADS_USE_CASE)
    .execute({ sector: values.sector ?? '', location: values.location ?? '' });
  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  if (!(error instanceof DomainError)) throw error;
  process.stderr.write(`\n${error.code}: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await app.close();
}
