import { ApiProperty } from '@nestjs/swagger';
import { CONFIDENCE_LEVELS } from '../../../core/domain/lead.js';
import { LeadContactDto } from './lead-contact.dto.js';

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

  @ApiProperty({ minimum: 0, maximum: 100, example: 85 })
  qualificationScore!: number;

  @ApiProperty({ example: 'Encaja con el sector, web propia, teléfono y email publicados.' })
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
