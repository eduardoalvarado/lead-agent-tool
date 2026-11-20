import { ApiProperty } from '@nestjs/swagger';

export class DiscardedCandidateDto {
  @ApiProperty({ example: 'Guía Médica Perú' })
  companyName!: string;

  @ApiProperty({ example: 'https://guiamedicaperu.com/dentistas/lima' })
  url!: string;

  @ApiProperty({ example: 'Directorio/agregador, no es una empresa.' })
  reason!: string;
}
