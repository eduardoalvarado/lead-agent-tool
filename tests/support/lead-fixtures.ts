import type { Lead } from '../../src/core/domain/lead.js';
import { scoreQualification } from '../../src/core/domain/qualification.js';
import { buildCandidate } from './fakes.js';

export function buildLead(overrides: Partial<Lead> = {}): Lead {
  const candidate = buildCandidate();
  const qualification = scoreQualification(candidate.qualificationSignals, candidate.contact);
  return {
    ...candidate,
    id: 'sonrisaclara.pe',
    requestedSector: 'Clínicas dentales',
    location: 'Lima, Perú',
    jobId: 'job-1',
    createdAt: '2026-11-20T10:00:00.000Z',
    qualificationScore: qualification.score,
    qualificationBreakdown: qualification.breakdown,
    qualificationReason: qualification.reason,
    ...overrides,
  };
}
