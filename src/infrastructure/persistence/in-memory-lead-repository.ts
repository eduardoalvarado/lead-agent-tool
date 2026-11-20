import type { Lead } from '../../core/domain/lead.js';
import type { LeadRepository, SaveLeadResult } from '../../core/ports/lead-repository.js';

/** Repositorio en memoria para el smoke test y demos sin DynamoDB. */
export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  async save(lead: Lead): Promise<SaveLeadResult> {
    if (this.leads.has(lead.id)) return 'duplicate';
    this.leads.set(lead.id, lead);
    return 'created';
  }

  async findAll(): Promise<Lead[]> {
    return [...this.leads.values()];
  }
}
