/**
 * Clave de deduplicación de un lead: hostname en minúsculas y sin `www.`.
 * `https://www.Clinica.pe/contacto` y `http://clinica.pe` producen `clinica.pe`.
 */
export function toDomainKey(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}
