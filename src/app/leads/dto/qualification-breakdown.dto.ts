import { ApiProperty } from '@nestjs/swagger';
import { QUALIFICATION_MAX } from '../../../core/domain/qualification.js';

export class QualificationBreakdownDto {
  @ApiProperty({
    minimum: 0,
    maximum: QUALIFICATION_MAX.fit,
    example: 35,
    description: 'Encaje con sector y ubicación',
  })
  fit!: number;

  @ApiProperty({
    minimum: 0,
    maximum: QUALIFICATION_MAX.legitimacy,
    example: 25,
    description: 'Web propia y dirección física',
  })
  legitimacy!: number;

  @ApiProperty({
    minimum: 0,
    maximum: QUALIFICATION_MAX.contactability,
    example: 15,
    description: 'Email, teléfono y dirección publicados',
  })
  contactability!: number;

  @ApiProperty({
    minimum: 0,
    maximum: QUALIFICATION_MAX.maturity,
    example: 10,
    description: 'Señales de tamaño o madurez',
  })
  maturity!: number;
}
