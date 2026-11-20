/**
 * Aviso que el código agrega al historial cuando la ejecución se acerca al límite de
 * iteraciones (AGENT_MAX_ITERATIONS): el LLM cierra lo pendiente en lugar de quedar cortado.
 */
export function buildIterationLimitNotice(remainingIterations: number): string {
  return `AVISO DEL SISTEMA: te quedan ${remainingIterations} respuestas antes del límite de iteraciones. No busques más: decide ahora con save_lead o discard_lead los candidatos pendientes y luego termina con tu resumen.`;
}
