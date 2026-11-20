import { ApiProperty } from '@nestjs/swagger';

// Solo documentación para Swagger: la validación real usa `SearchCriteriaSchema` del núcleo.
export class SearchLeadsRequestDto {
  @ApiProperty({ example: 'Clínicas dentales', minLength: 2, maxLength: 100 })
  sector!: string;

  @ApiProperty({ example: 'Lima, Perú', minLength: 2, maxLength: 100 })
  location!: string;
}
