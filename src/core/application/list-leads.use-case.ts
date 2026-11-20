import type { Lead } from '../domain/lead.js';
import type { LeadRepository } from '../ports/lead-repository.js';

/** Lista los leads guardados, priorizados por `qualificationScore` (mayor primero). */
export class ListLeadsUseCase {
  constructor(private readonly repository: LeadRepository) {}

  async execute(): Promise<Lead[]> {
    const leads = await this.repository.findAll();
    return leads.toSorted((a, b) => b.qualificationScore - a.qualificationScore);
  }
}
