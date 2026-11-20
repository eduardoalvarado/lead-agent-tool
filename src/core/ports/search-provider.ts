export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly content: string;
}

export interface SearchProvider {
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}
