import { z } from 'zod';
import type { ToolExecutionContext, ToolResult } from './agent-tool.js';
import { ZodTool } from './zod-tool.js';

const DiscardLeadArgsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe('Nombre del candidato o del sitio descartado.'),
  url: z
    .url({ protocol: /^https?$/ })
    .describe('URL exacta del resultado de búsqueda que se descarta.'),
  reason: z
    .string()
    .trim()
    .min(5)
    .max(300)
    .describe(
      'Motivo concreto: directorio/agregador, fuera de la ubicación, otro sector, sin sitio web propio, datos insuficientes, etc.',
    ),
});

/** Registra de forma estructurada por qué un candidato no se guardó (resumen final). */
export class DiscardLeadTool extends ZodTool<typeof DiscardLeadArgsSchema> {
  protected readonly name = 'discard_lead';

  protected readonly description =
    'Registra un candidato que NO cumple los criterios (directorio, red social, otra ubicación u otro sector, sin web propia…), con su URL y el motivo. Cuenta como decisión para poder seguir buscando.';

  protected readonly schema = DiscardLeadArgsSchema;

  protected async run(
    candidate: z.output<typeof DiscardLeadArgsSchema>,
    { ledger }: ToolExecutionContext,
  ): Promise<ToolResult> {
    ledger.markDecided(candidate.url);
    return {
      output: `DESCARTE REGISTRADO: ${candidate.companyName}.`,
      outcome: { kind: 'discarded', candidate },
    };
  }
}
