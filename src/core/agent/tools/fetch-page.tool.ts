import { z } from 'zod';
import type { PageFetcher } from '../../ports/page-fetcher.js';
import { NO_OUTCOME, type ToolExecutionContext, type ToolResult } from './agent-tool.js';
import { truncate } from './truncate.js';
import { ZodTool } from './zod-tool.js';

export const DEFAULT_FETCH_PAGE_MAX_CHARS = 1500;

const FetchPageArgsSchema = z.object({
  url: z.url({ protocol: /^https?$/ }).describe('URL de la página a leer.'),
});

export class FetchPageTool extends ZodTool<typeof FetchPageArgsSchema> {
  protected readonly name = 'fetch_page';

  protected readonly description =
    'Lee una página de la web propia de una empresa (p. ej. contacto) para confirmar datos.';

  protected readonly schema = FetchPageArgsSchema;

  constructor(
    private readonly pageFetcher: PageFetcher,
    private readonly maxChars: number = DEFAULT_FETCH_PAGE_MAX_CHARS,
  ) {
    super();
  }

  protected async run(
    { url }: z.output<typeof FetchPageArgsSchema>,
    { ledger }: ToolExecutionContext,
  ): Promise<ToolResult> {
    // Guarda del flujo ReAct: tras leer una empresa, decidir antes de leer otra.
    const undecided = ledger.undecidedFetchesExcept(url);
    if (undecided.length > 0) {
      return {
        output: `BLOQUEADO: antes de leer otra empresa, llama a save_lead o discard_lead para la(s) página(s) que ya leíste: ${undecided.join(', ')}`,
        outcome: NO_OUTCOME,
      };
    }

    const page = await this.pageFetcher.fetch(url);
    ledger.registerFetched(url);
    const output = {
      url: page.url,
      title: page.title,
      text: truncate(page.text, this.maxChars),
      truncated: page.text.length > this.maxChars,
    };
    return { output: JSON.stringify(output), outcome: NO_OUTCOME };
  }
}
