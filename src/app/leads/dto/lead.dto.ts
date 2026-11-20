import { ApiProperty } from '@nestjs/swagger';
import { CONFIDENCE_LEVELS } from '../../../core/domain/lead.js';
import { LeadContactDto } from './lead-contact.dto.js';
import { QualificationBreakdownDto } from './qualification-breakdown.dto.js';
import { QualificationSignalsDto } from './qualification-signals.dto.js';

// Documentación Swagger del Lead; la forma real la define `LeadSchema` (Zod) en el núcleo.

export class LeadDto {
  @ApiProperty({
    description: 'Dominio normalizado (clave de deduplicación)',
    example: 'sonrisaclara.pe',
  })
  id!: string;

  @ApiProperty({ example: 'Clínica Dental Sonrisa Clara' })
  companyName!: string;

  @ApiProperty({ description: 'Sector solicitado en la búsqueda', example: 'Clínicas dentales' })
  requestedSector!: string;

  @ApiProperty({ description: 'Especialidad detectada', example: 'Ortodoncia invisible' })
  subSector!: string;

  @ApiProperty({ example: 'Lima, Perú' })
  location!: string;

  @ApiProperty({ example: 'Clínica dental en Miraflores especializada en ortodoncia invisible.' })
  summary!: string;

  @ApiProperty({ type: LeadContactDto })
  contact!: LeadContactDto;

  @ApiProperty({ type: QualificationSignalsDto, description: 'Señales aportadas por el LLM' })
  qualificationSignals!: QualificationSignalsDto;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 85,
    description: 'Calculado por el código (suma del desglose)',
  })
  qualificationScore!: number;

  @ApiProperty({ type: QualificationBreakdownDto })
  qualificationBreakdown!: QualificationBreakdownDto;

  @ApiProperty({
    example:
      'Encaje 35 (sector exacto, ubicación confirmada) · Legitimidad 25 (web propia, dirección física) · Contactabilidad 15 (teléfono, dirección) · Madurez 10 (2 sedes; 12 especialistas)',
  })
  qualificationReason!: string;

  @ApiProperty({ enum: CONFIDENCE_LEVELS, example: 'high' })
  confidence!: string;

  @ApiProperty({ example: 'https://sonrisaclara.pe/' })
  sourceUrl!: string;

  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
