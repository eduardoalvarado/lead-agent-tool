import { ApiProperty } from '@nestjs/swagger';

export class JobAcceptedDto {
  @ApiProperty({ format: 'uuid' })
  jobId!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;

  @ApiProperty({ example: '/jobs/2f1c…', description: 'Ruta para consultar el estado del job' })
  statusUrl!: string;
}
