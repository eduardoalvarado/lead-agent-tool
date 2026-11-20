import { z } from 'zod';
import type { LeadAgent } from '../agent/lead-agent.js';
import type { AgentRunSummary } from '../domain/run-summary.js';
import { InvalidSearchCriteriaError } from '../domain/errors/invalid-search-criteria.error.js';
import { SearchCriteriaSchema } from '../domain/search-criteria.js';
import type { IdGenerator } from '../ports/system.js';

/** Caso de uso único que reutilizan HTTP, CLI y Lambda. */
export class SearchLeadsUseCase {
  constructor(
    private readonly agent: LeadAgent,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: { sector: string; location: string }): Promise<AgentRunSummary> {
    const parsed = SearchCriteriaSchema.safeParse(input);
    if (!parsed.success) throw new InvalidSearchCriteriaError(z.prettifyError(parsed.error));
    return this.agent.run(parsed.data, this.ids.generate());
  }
}
