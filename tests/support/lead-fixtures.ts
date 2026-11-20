import type { Lead } from '../../src/core/domain/lead.js';
import { buildCandidate } from './fakes.js';

export function buildLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...buildCandidate(),
    id: 'sonrisaclara.pe',
    requestedSector: 'Clínicas dentales',
    location: 'Lima, Perú',
    jobId: 'job-1',
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}
