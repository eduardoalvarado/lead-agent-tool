import { isAggregatorDomain } from '../domain/aggregator-domains.js';
import { toDomainKey } from '../domain/domain-name.js';

function safeDomain(url: string): string | null {
  try {
    return toDomainKey(url);
  } catch {
    return null;
  }
}

/**
 * Registro de candidatos de una ejecución: qué URLs devolvió la búsqueda y cuáles ya
 * tienen decisión (save_lead o discard_lead). Permite imponer en código la regla
 * "decidir lo encontrado antes de buscar más" y detectar búsquedas sin novedades.
 *
 * Una decisión sobre una empresa cubre todas sus páginas (mismo dominio), salvo en
 * agregadores y redes sociales, donde cada URL es un candidato distinto.
 */
export class CandidateLedger {
  private readonly seenUrls = new Set<string>();

  private readonly decidedUrls = new Set<string>();

  private readonly decidedDomains = new Set<string>();

  private readonly fetchedUrls = new Set<string>();

  /** Registra URLs devueltas por una búsqueda y devuelve solo las nuevas. */
  registerSeen(urls: readonly string[]): string[] {
    const fresh = urls.filter((url) => !this.seenUrls.has(url));
    fresh.forEach((url) => this.seenUrls.add(url));
    return fresh;
  }

  registerFetched(url: string): void {
    this.fetchedUrls.add(url);
  }

  /** Páginas leídas de OTRAS empresas que aún no tienen decisión (bloquean leer una nueva). */
  undecidedFetchesExcept(url: string): string[] {
    const domain = safeDomain(url);
    return [...this.fetchedUrls].filter(
      (fetched) => !this.isDecided(fetched) && safeDomain(fetched) !== domain,
    );
  }

  markDecided(url: string): void {
    this.decidedUrls.add(url);
    const domain = safeDomain(url);
    if (domain && !isAggregatorDomain(domain)) this.decidedDomains.add(domain);
  }

  /** URLs vistas que aún no tienen decisión. */
  pending(): string[] {
    return [...this.seenUrls].filter((url) => !this.isDecided(url));
  }

  private isDecided(url: string): boolean {
    if (this.decidedUrls.has(url)) return true;
    const domain = safeDomain(url);
    return domain !== null && this.decidedDomains.has(domain);
  }
}
