// Casos dorados sobre el dataset mock (src/infrastructure/search/mock-search-dataset.ts):
// qué empresas son leads válidos y qué resultados son trampas que nunca deben guardarse.

export interface GoldenCase {
  readonly id: string;
  readonly sector: string;
  readonly location: string;
  /** Dominios de los leads válidos esperados. */
  readonly expected: readonly string[];
  /** Dominios de directorios, redes sociales, otra ubicación u otro sector. */
  readonly traps: readonly string[];
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    id: 'marketing-lima',
    sector: 'Agencias de marketing',
    location: 'Lima, Perú',
    expected: ['pulsodigital-agencia.pe', 'andinacreativa.pe', 'nexogrowth.pe'],
    traps: [
      'rankingagencias-peru.com',
      'instagram.com',
      'brujulamkt.pe',
      'academiamarketingpro.pe',
    ],
  },
  {
    id: 'dental-lima',
    sector: 'Clínicas dentales',
    location: 'Lima, Perú',
    expected: ['sonrisaclara.pe', 'odontolosolivos.pe', 'dentalia-implantes.pe'],
    traps: ['guiamedicaperu.com', 'facebook.com', 'cuscodental.pe'],
  },
];
