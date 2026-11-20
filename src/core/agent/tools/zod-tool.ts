import { z } from 'zod';
import type { ToolDefinition } from '../../ports/llm-provider.js';
import {
  type AgentTool,
  NO_OUTCOME,
  type ToolExecutionContext,
  type ToolResult,
} from './agent-tool.js';

/** JSON Schema compacto para el LLM: sin `$schema` ni regex internas que solo agregan ruido. */
function toToolParameters(schema: z.ZodType): Record<string, unknown> {
  const { $schema: ignoredSchemaUri, ...parameters } = z.toJSONSchema(schema, {
    override: ({ jsonSchema }) => {
      // La API `override` de Zod está diseñada para mutar el nodo generado.
      // eslint-disable-next-line no-param-reassign
      delete jsonSchema.pattern;
    },
  });
  return parameters;
}

/**
 * Tool cuyos argumentos se describen y validan con un único schema Zod: el mismo schema
 * genera el JSON Schema que ve el LLM y valida lo que el LLM envía. Si la validación falla,
 * el error vuelve al LLM como resultado (no se lanza) para que se autocorrija.
 */
export abstract class ZodTool<TSchema extends z.ZodType> implements AgentTool {
  protected abstract readonly name: string;

  protected abstract readonly description: string;

  protected abstract readonly schema: TSchema;

  get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: toToolParameters(this.schema),
    };
  }

  async execute(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const parsed = this.schema.safeParse(args);
    if (!parsed.success) {
      return {
        output: `ERROR DE VALIDACIÓN: corrige los argumentos y vuelve a llamar a ${this.name}.\n${z.prettifyError(parsed.error)}`,
        outcome: NO_OUTCOME,
      };
    }
    return this.run(parsed.data, context);
  }

  protected abstract run(
    args: z.output<TSchema>,
    context: ToolExecutionContext,
  ): Promise<ToolResult>;
}
