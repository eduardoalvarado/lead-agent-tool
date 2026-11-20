import { ApiProperty } from '@nestjs/swagger';
import { STOP_REASONS } from '../../../core/domain/run-summary.js';
import { DiscardedCandidateDto } from './discarded-candidate.dto.js';
import { LeadDto } from './lead.dto.js';
import { RunUsageDto } from './run-usage.dto.js';
import { SearchLeadsRequestDto } from './search-leads-request.dto.js';

export class RunSummaryDto {
  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ type: SearchLeadsRequestDto })
  criteria!: SearchLeadsRequestDto;

  @ApiProperty({ type: [LeadDto] })
  savedLeads!: LeadDto[];

  @ApiProperty({ type: [DiscardedCandidateDto] })
  discarded!: DiscardedCandidateDto[];

  @ApiProperty({ example: 7 })
  iterations!: number;

  @ApiProperty({ enum: [...STOP_REASONS], example: 'completed' })
  stopReason!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resumen final del agente' })
  finalMessage!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Motivo si stopReason=llm_error' })
  error!: string | null;

  @ApiProperty({ type: RunUsageDto })
  usage!: RunUsageDto;
}
