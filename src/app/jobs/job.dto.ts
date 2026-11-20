import { ApiProperty } from '@nestjs/swagger';
import { JOB_STATUSES } from '../../core/domain/job.js';
import { RunSummaryDto } from '../leads/dto/run-summary.dto.js';
import { SearchLeadsRequestDto } from '../leads/dto/search-leads-request.dto.js';

export class JobDto {
  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ type: SearchLeadsRequestDto })
  criteria!: SearchLeadsRequestDto;

  @ApiProperty({ enum: JOB_STATUSES, example: 'completed' })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: RunSummaryDto, nullable: true, description: 'Disponible al completarse' })
  summary!: RunSummaryDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Motivo si el job falló' })
  error!: string | null;
}
