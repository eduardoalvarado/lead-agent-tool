// Evaluación del agente con casos dorados (modo mock): precisión, recall, trampas y alucinaciones.
// Uso: npm run eval   (requiere la key del LLM; no usa red de búsqueda ni base de datos)
import { loadAppConfig } from '../src/app/config/app-config.js';
import { SearchLeadsUseCase } from '../src/core/application/search-leads.use-case.js';
import { toDomainKey } from '../src/core/domain/domain-name.js';
import { InMemoryLeadRepository } from '../src/infrastructure/persistence/in-memory-lead-repository.js';
import { MOCK_SECTORS } from '../src/infrastructure/search/mock-search-dataset.js';
import { UuidGenerator } from '../src/infrastructure/system/uuid-generator.js';
import { GOLDEN_CASES } from './eval/golden-cases.js';
import { type RunScore, scoreRun, type SourceLookup } from './eval/score.js';
import { composeAgent } from './support/compose-agent.js';

const config = { ...loadAppConfig(process.env), SEARCH_PROVIDER: 'mock' as const };

const sourceByDomain = new Map<string, string>();
MOCK_SECTORS.flatMap((sector) => sector.pages).forEach((page) => {
  const domain = toDomainKey(page.url);
  const text = [page.title, page.snippet, page.pageText ?? ''].join('\n');
  sourceByDomain.set(domain, `${sourceByDomain.get(domain) ?? ''}\n${text}`);
});
const source: SourceLookup = (domain) => sourceByDomain.get(domain);

const percent = (value: number) => `${Math.round(value * 100)} %`;

const scores: RunScore[] = [];
for (const golden of GOLDEN_CASES) {
  process.stdout.write(`\n=== Caso ${golden.id}: ${golden.sector} · ${golden.location} ===\n`);
  const agent = composeAgent(config, new InMemoryLeadRepository());
  // eslint-disable-next-line no-await-in-loop -- los casos se ejecutan en serie (rate limits del LLM)
  const summary = await new SearchLeadsUseCase(agent, new UuidGenerator()).execute(golden);
  scores.push(scoreRun(summary, golden, source));
}

process.stdout.write('\n=== Resultados ===\n');
// eslint-disable-next-line no-console -- la salida de la evaluación es una tabla para la terminal
console.table(
  scores.map((s) => ({
    caso: s.caseId,
    guardados: s.saved.length,
    precision: percent(s.precision),
    recall: percent(s.recall),
    'trampas guardadas': s.trapsSaved.length,
    'trampas descartadas': s.trapsDiscarded.length,
    alucinaciones: s.hallucinations.length,
    fin: s.stopReason,
    iteraciones: s.iterations,
  })),
);
scores
  .flatMap((s) => s.hallucinations)
  .forEach((h) => process.stdout.write(`Alucinación: ${h.leadId} · ${h.field} = "${h.value}"\n`));

const incomplete = scores.filter((s) => s.stopReason === 'llm_error').map((s) => s.caseId);
if (incomplete.length > 0) {
  process.stdout.write(
    `\nEvaluación INCOMPLETA: el LLM falló en ${incomplete.join(', ')} (ver logs). Las métricas de esos casos no son concluyentes.\n`,
  );
}
const failed = scores.some((s) => s.trapsSaved.length > 0 || s.hallucinations.length > 0);
process.exitCode = failed || incomplete.length > 0 ? 1 : 0;
