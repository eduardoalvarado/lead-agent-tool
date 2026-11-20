import { z } from 'zod';
import type { SearchProvider } from '../../ports/search-provider.js';
import { NO_OUTCOME, type ToolExecutionContext, type ToolResult } from './agent-tool.js';
import { truncate } from './truncate.js';
import { ZodTool } from './zod-tool.js';

export interface SearchWebToolOptions {
  readonly maxResults: number;
  /** Límite de caracteres por snippet para no saturar el contexto del LLM. */
  readonly maxSnippetChars: number;
}

export const DEFAULT_SEARCH_WEB_OPTIONS: SearchWebToolOptions = {
  maxResults: 5,
  maxSnippetChars: 500,
};

const NO_NEW_RESULTS_MESSAGE =
  'SIN NOVEDADES: todos los resultados ya los viste en búsquedas anteriores. Prueba una consulta distinta (otro distrito o sinónimo) o, si ya lo hiciste, termina con el resumen.';

const SearchWebArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .describe('Consulta de búsqueda en lenguaje natural, incluyendo sector y ubicación.'),
});

export class SearchWebTool extends ZodTool<typeof SearchWebArgsSchema> {
  protected readonly name = 'search_web';

  protected readonly description =
    'Busca en internet y devuelve hasta 5 resultados (título, URL y extracto). Omite los resultados que ya viste en esta ejecución. Se bloquea si quedan candidatos de búsquedas anteriores sin save_lead o discard_lead.';

  protected readonly schema = SearchWebArgsSchema;

  constructor(
    private readonly searchProvider: SearchProvider,
    private readonly options: SearchWebToolOptions = DEFAULT_SEARCH_WEB_OPTIONS,
  ) {
    super();
  }

  protected async run(
    { query }: z.output<typeof SearchWebArgsSchema>,
    { ledger }: ToolExecutionContext,
  ): Promise<ToolResult> {
    // Guarda del flujo ReAct: decidir lo encontrado antes de buscar más.
    const pending = ledger.pending();
    if (pending.length > 0) {
      return {
        output: `BLOQUEADO: antes de buscar de nuevo, llama a save_lead o discard_lead para cada uno de estos resultados pendientes: ${pending.join(', ')}`,
        outcome: NO_OUTCOME,
      };
    }

    const results = await this.searchProvider.search(query, this.options.maxResults);
    if (results.length === 0) {
      return { output: 'Sin resultados. Prueba con otra consulta.', outcome: NO_OUTCOME };
    }

    // Solo resultados no vistos en esta ejecución: el LLM no reevalúa candidatos repetidos
    // y recibe una señal explícita cuando ya no hay novedades.
    const freshUrls = new Set(ledger.registerSeen(results.map(({ url }) => url)));
    const fresh = results.filter(({ url }) => freshUrls.has(url));
    if (fresh.length === 0) {
      return { output: NO_NEW_RESULTS_MESSAGE, outcome: NO_OUTCOME };
    }

    const compact = fresh.map(({ title, url, content }) => ({
      title,
      url,
      content: truncate(content, this.options.maxSnippetChars),
    }));
    return { output: JSON.stringify(compact), outcome: NO_OUTCOME };
  }
}
