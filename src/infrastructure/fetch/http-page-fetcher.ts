import { PageFetchError } from '../../core/domain/errors/page-fetch.error.js';
import type { FetchedPage, PageFetcher } from '../../core/ports/page-fetcher.js';
import { describeError } from '../shared/describe-error.js';
import { extractTitle, htmlToText } from './html-to-text.js';

export interface HttpPageFetcherOptions {
  readonly timeoutMs: number;
  readonly userAgent: string;
}

const READABLE_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

export class HttpPageFetcher implements PageFetcher {
  constructor(private readonly options: HttpPageFetcherOptions) {}

  async fetch(url: string): Promise<FetchedPage> {
    const response = await this.request(url);
    if (!response.ok) throw new PageFetchError(`HTTP ${response.status} al leer ${url}`);

    const contentType = response.headers.get('content-type') ?? '';
    if (!READABLE_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      throw new PageFetchError(`Contenido no legible (${contentType || 'desconocido'}) en ${url}`);
    }

    const html = await response.text();
    return { url: response.url || url, title: extractTitle(html), text: htmlToText(html) };
  }

  private async request(url: string): Promise<Response> {
    try {
      return await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.options.timeoutMs),
        headers: { 'user-agent': this.options.userAgent, accept: 'text/html,text/plain' },
      });
    } catch (error) {
      throw new PageFetchError(`No se pudo leer ${url}: ${describeError(error)}`, { cause: error });
    }
  }
}
