import { tavily } from '@tavily/core';
import { SearchProviderError } from '../../core/domain/errors/search-provider.error.js';
import { describeError } from '../shared/describe-error.js';
import type { SearchProvider, SearchResult } from '../../core/ports/search-provider.js';

export interface TavilyProviderOptions {
  readonly apiKey: string;
  readonly timeoutMs: number;
}

export class TavilyProvider implements SearchProvider {
  private readonly client: ReturnType<typeof tavily>;

  constructor(private readonly options: TavilyProviderOptions) {
    this.client = tavily({ apiKey: options.apiKey });
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const response = await this.client.search(query, {
        maxResults,
        searchDepth: 'basic',
        topic: 'general',
        timeout: this.options.timeoutMs,
      });
      return response.results.map(({ title, url, content }) => ({ title, url, content }));
    } catch (error) {
      throw new SearchProviderError(`Tavily: ${describeError(error)}`, { cause: error });
    }
  }
}
