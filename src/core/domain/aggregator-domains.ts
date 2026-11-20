// Defensa en profundidad contra leads que no son la empresa: el prompt pide descartarlos,
// y esta lista lo garantiza en código para los casos más comunes.
const AGGREGATOR_DOMAINS: readonly string[] = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'wa.me',
  'whatsapp.com',
  'google.com',
  'goo.gl',
  'linktr.ee',
  'paginasamarillas.com.pe',
  'doctoralia.pe',
  'tripadvisor.com',
  'tripadvisor.com.pe',
  'yelp.com',
  'clutch.co',
  'mercadolibre.com.pe',
  'computrabajo.com.pe',
  'universidadperu.com',
];

/** `true` si el dominio (o un subdominio suyo) es una red social, directorio o agregador. */
export function isAggregatorDomain(domain: string): boolean {
  return AGGREGATOR_DOMAINS.some(
    (aggregator) => domain === aggregator || domain.endsWith(`.${aggregator}`),
  );
}
