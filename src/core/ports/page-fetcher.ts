export interface FetchedPage {
  readonly url: string;
  readonly title: string | null;
  /** Texto plano de la página (sin HTML). */
  readonly text: string;
}

export interface PageFetcher {
  fetch(url: string): Promise<FetchedPage>;
}
