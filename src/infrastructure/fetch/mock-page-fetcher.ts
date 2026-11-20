import { PageFetchError } from '../../core/domain/errors/page-fetch.error.js';
import type { FetchedPage, PageFetcher } from '../../core/ports/page-fetcher.js';
import { MOCK_SECTORS, type MockSector } from '../search/mock-search-dataset.js';

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/** Sirve las páginas del dataset ficticio: el modo mock no hace peticiones de red. */
export class MockPageFetcher implements PageFetcher {
  private readonly pages: ReadonlyMap<string, FetchedPage>;

  constructor(sectors: readonly MockSector[] = MOCK_SECTORS) {
    this.pages = new Map(
      sectors
        .flatMap((sector) => sector.pages)
        .map((page) => [
          withoutTrailingSlash(page.url),
          { url: page.url, title: page.title, text: page.pageText ?? page.snippet },
        ]),
    );
  }

  async fetch(url: string): Promise<FetchedPage> {
    const page = this.pages.get(withoutTrailingSlash(url));
    if (!page) throw new PageFetchError(`La página ${url} no existe en el dataset mock.`);
    return page;
  }
}
