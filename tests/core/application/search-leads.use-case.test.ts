import { describe, expect, it } from 'vitest';
import { LeadAgent } from '../../../src/core/agent/lead-agent.js';
import { SearchLeadsUseCase } from '../../../src/core/application/search-leads.use-case.js';
import { InvalidSearchCriteriaError } from '../../../src/core/domain/errors/invalid-search-criteria.error.js';
import { answer, ScriptedLlm, SilentLogger } from '../../support/fakes.js';

function buildUseCase() {
  const llm = new ScriptedLlm([answer('Sin candidatos.')]);
  const agent = new LeadAgent(llm, [], new SilentLogger(), { maxIterations: 1, maxLeads: 1 });
  return new SearchLeadsUseCase(agent, { generate: () => 'job-42' });
}

describe('SearchLeadsUseCase', () => {
  it('normaliza el input y ejecuta el agente con un jobId nuevo', async () => {
    const summary = await buildUseCase().execute({
      sector: '  Clínicas dentales ',
      location: 'Lima',
    });

    expect(summary.jobId).toBe('job-42');
    expect(summary.criteria).toEqual({ sector: 'Clínicas dentales', location: 'Lima' });
  });

  it('rechaza criterios inválidos con un error de dominio', async () => {
    await expect(buildUseCase().execute({ sector: '', location: 'Lima' })).rejects.toThrow(
      InvalidSearchCriteriaError,
    );
  });
});
