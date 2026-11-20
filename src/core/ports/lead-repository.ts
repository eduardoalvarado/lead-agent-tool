import type { Lead } from '../domain/lead.js';

/** `duplicate`: ya existía un lead con el mismo `id` (dominio); no se sobrescribe. */
export type SaveLeadResult = 'created' | 'duplicate';

export interface LeadRepository {
  save(lead: Lead): Promise<SaveLeadResult>;
  findAll(): Promise<Lead[]>;
}
