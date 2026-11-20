import type { z } from 'zod';
import { toDomainKey } from '../../domain/domain-name.js';
import { type Lead, LeadCandidateSchema } from '../../domain/lead.js';
import { scoreQualification } from '../../domain/qualification.js';
import type { LeadRepository } from '../../ports/lead-repository.js';
import type { Clock } from '../../ports/system.js';
import type { ToolExecutionContext, ToolResult } from './agent-tool.js';
import { ZodTool } from './zod-tool.js';

export class SaveLeadTool extends ZodTool<typeof LeadCandidateSchema> {
  protected readonly name = 'save_lead';

  protected readonly description =
    'Guarda un lead con datos copiados tal cual de la fuente (null si no aparecen).';

  protected readonly schema = LeadCandidateSchema;

  constructor(
    private readonly repository: LeadRepository,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async run(
    candidate: z.output<typeof LeadCandidateSchema>,
    { criteria, jobId, ledger }: ToolExecutionContext,
  ): Promise<ToolResult> {
    // Sector solicitado, ubicación, jobId, id y el puntaje los asigna el código, nunca el LLM.
    const qualification = scoreQualification(candidate.qualificationSignals, candidate.contact);
    const lead: Lead = {
      ...candidate,
      qualificationScore: qualification.score,
      qualificationBreakdown: qualification.breakdown,
      qualificationReason: qualification.reason,
      id: toDomainKey(candidate.contact.website),
      requestedSector: criteria.sector,
      location: criteria.location,
      jobId,
      createdAt: this.clock.now().toISOString(),
    };

    const result = await this.repository.save(lead);
    ledger.markDecided(lead.sourceUrl);
    ledger.markDecided(lead.contact.website);
    if (result === 'duplicate') {
      return {
        output: `DUPLICADO: ya existe un lead con el dominio ${lead.id}. No lo vuelvas a guardar.`,
        outcome: {
          kind: 'discarded',
          candidate: {
            companyName: lead.companyName,
            url: lead.contact.website,
            reason: `Duplicado: el dominio ${lead.id} ya estaba guardado.`,
          },
        },
      };
    }
    return {
      output: `GUARDADO: lead ${lead.id} (puntaje ${lead.qualificationScore}).`,
      outcome: { kind: 'saved', lead },
    };
  }
}
