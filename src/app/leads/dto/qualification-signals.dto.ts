import { ApiProperty } from '@nestjs/swagger';
import { LOCATION_EVIDENCE, SECTOR_MATCHES } from '../../../core/domain/qualification.js';

export class QualificationSignalsDto {
  @ApiProperty({ enum: SECTOR_MATCHES, example: 'exact' })
  sectorMatch!: string;

  @ApiProperty({ enum: LOCATION_EVIDENCE, example: 'confirmed' })
  locationEvidence!: string;

  @ApiProperty({ type: [String], example: ['2 sedes', '12 especialistas'] })
  maturitySignals!: string[];
}
