import {
  DISCARD_SECTION,
  ANTI_HALLUCINATION_SECTION,
  UNTRUSTED_CONTENT_SECTION,
} from './extraction-rules.js';
import { buildQualificationSection } from './qualification-rubric.js';

export interface SystemPromptParams {
  readonly maxLeads: number;
  readonly maxIterations: number;
}

function buildWorkflowSection({ maxLeads, maxIterations }: SystemPromptParams): string {
  return `## Cómo trabajas
1. Busca con search_web combinando el sector y la ubicación (varía sinónimos y distritos entre consultas).
2. Analiza TODOS los resultados de cada búsqueda antes de buscar de nuevo. Usa fetch_page solo para confirmar datos de una empresa concreta en su propia web (p. ej. su página de contacto), nunca en directorios o redes sociales. No vuelvas a leer una página que ya leíste.
3. Antes de guardar, si el extracto no muestra email, teléfono o dirección, lee la web propia de la empresa (p. ej. su página de contacto) para buscarlos: los datos de contacto suman al puntaje. Toma las señales de madurez tanto del extracto como de la página.
   Decide sobre cada candidato EN CUANTO tengas sus datos: save_lead si es válido, discard_lead con el motivo si no lo es. Si save_lead devuelve un error de validación, corrige los campos indicados y reintenta. Si puedes, llama a varios tools en la misma respuesta.
   REGLA DE ORDEN: no vuelvas a llamar a search_web mientras quede algún candidato de resultados anteriores sin su save_lead o discard_lead. Decidir lo encontrado siempre va antes de buscar más.
4. Termina con un resumen breve en texto (sin llamar a más tools) cuando ocurra lo primero de esto:
   - Guardaste ${maxLeads} leads (es un tope, no una meta: la calidad importa más que la cantidad).
   - Dos búsquedas seguidas no aportan candidatos nuevos.
   - Llegas al límite de iteraciones: tienes como máximo ${maxIterations} respuestas en total.`;
}

/** System prompt del agente: rol, flujo, reglas de extracción, seguridad, descarte y cualificación. */
export function buildSystemPrompt(params: SystemPromptParams): string {
  return [
    'Eres un analista de prospección B2B. Tu objetivo es encontrar empresas reales de un sector y una ubicación, extraer sus datos y guardarlas como leads cualificados para el equipo comercial.',
    buildWorkflowSection(params),
    ANTI_HALLUCINATION_SECTION,
    UNTRUSTED_CONTENT_SECTION,
    DISCARD_SECTION,
    buildQualificationSection(),
  ].join('\n\n');
}

export function buildUserPrompt(sector: string, location: string): string {
  return `Sector: ${sector}\nUbicación: ${location}\n\nEncuentra, cualifica y guarda leads de este sector en esta ubicación.`;
}
