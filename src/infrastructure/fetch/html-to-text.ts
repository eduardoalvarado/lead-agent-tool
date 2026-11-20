// Conversión HTML → texto deliberadamente simple: suficiente para que el LLM lea una
// página de contacto. Un scraper real (render de JS, boilerplate removal) queda fuera
// del alcance de la PoC (ver limitaciones en el README).

const NON_CONTENT_BLOCKS = /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const BLOCK_TAGS = /<\/?(p|div|br|li|tr|h[1-6]|section|article|header|footer|address)\b[^>]*>/gi;
const ANY_TAG = /<[^>]+>/g;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

const ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

export function extractTitle(html: string): string | null {
  const title = TITLE.exec(html)?.[1]?.trim();
  return title ? decodeEntities(title) : null;
}

export function htmlToText(html: string): string {
  const text = html
    .replace(NON_CONTENT_BLOCKS, ' ')
    .replace(COMMENTS, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(ANY_TAG, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
