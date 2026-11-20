// Smoke test del núcleo SIN NestJS contra el LLM real, con repositorio en memoria.
// Uso: npm run smoke -- --sector "Clínicas dentales" --location "Lima, Perú"
import { parseArgs } from 'node:util';
import { loadAppConfig } from '../src/app/config/app-config.js';
import { SearchLeadsUseCase } from '../src/core/application/search-leads.use-case.js';
import { InMemoryLeadRepository } from '../src/infrastructure/persistence/in-memory-lead-repository.js';
import { UuidGenerator } from '../src/infrastructure/system/uuid-generator.js';
import { composeAgent } from './support/compose-agent.js';

const { values } = parseArgs({
  options: {
    sector: { type: 'string', default: 'Agencias de marketing' },
    location: { type: 'string', default: 'Lima, Perú' },
  },
});

const agent = composeAgent(loadAppConfig(process.env), new InMemoryLeadRepository());
const summary = await new SearchLeadsUseCase(agent, new UuidGenerator()).execute({
  sector: values.sector,
  location: values.location,
});
process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
