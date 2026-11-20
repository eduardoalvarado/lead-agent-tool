import { ApiProperty } from '@nestjs/swagger';

export class RunUsageDto {
  @ApiProperty({ example: 12, description: 'Llamadas al LLM en la ejecución' })
  llmCalls!: number;

  @ApiProperty({ example: 48210, description: 'Tokens de entrada (todas las llamadas)' })
  inputTokens!: number;

  @ApiProperty({ example: 3120, description: 'Tokens de salida (incluye razonamiento)' })
  outputTokens!: number;
}
