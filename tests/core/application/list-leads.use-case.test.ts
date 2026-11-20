import { describe, expect, it } from 'vitest';
import { ListLeadsUseCase } from '../../../src/core/application/list-leads.use-case.js';
import { FakeLeadRepository } from '../../support/fakes.js';
import { buildLead } from '../../support/lead-fixtures.js';

describe('ListLeadsUseCase', () => {
  it('prioriza los leads por qualificationScore (mayor primero)', async () => {
    const repository = new FakeLeadRepository();
    await repository.save(buildLead({ id: 'a.pe', qualificationScore: 40 }));
    await repository.save(buildLead({ id: 'b.pe', qualificationScore: 90 }));
    await repository.save(buildLead({ id: 'c.pe', qualificationScore: 65 }));

    const leads = await new ListLeadsUseCase(repository).execute();

    expect(leads.map((lead) => lead.id)).toEqual(['b.pe', 'c.pe', 'a.pe']);
  });
});
