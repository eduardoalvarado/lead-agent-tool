import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Valida el body con un schema Zod del núcleo: una sola fuente de verdad para la entrada. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Entrada inválida',
        errors: z.prettifyError(parsed.error),
      });
    }
    return parsed.data;
  }
}
