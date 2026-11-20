import type { SearchProvider, SearchResult } from '../../core/ports/search-provider.js';
import { MOCK_SECTORS, type MockPage, type MockSector } from './mock-search-dataset.js';

/** Minúsculas y sin tildes, para comparar consultas con el dataset. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesSector(sector: MockSector, query: string): boolean {
  return sector.keywords.some((keyword) => query.includes(keyword));
}

/** Cantidad de palabras de la consulta presentes en la página: ordena por relevancia. */
function relevance(page: MockPage, queryWords: readonly string[]): number {
  const haystack = normalizeText(`${page.title} ${page.snippet}`);
  return queryWords.filter((word) => haystack.includes(word)).length;
}

/**
 * Simula un buscador sobre un dataset ficticio de Lima. Distintas consultas producen
 * distinto orden, de modo que el agente puede descubrir más candidatos reformulando.
 */
export class MockSearchProvider implements SearchProvider {
  constructor(private readonly sectors: readonly MockSector[] = MOCK_SECTORS) {}

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\W+/).filter((word) => word.length > 3);

    return this.sectors
      .filter((sector) => matchesSector(sector, normalizedQuery))
      .flatMap((sector) => sector.pages)
      .map((page) => ({ page, score: relevance(page, queryWords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ page }) => ({ title: page.title, url: page.url, content: page.snippet }));
  }
}
