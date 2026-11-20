/** Aviso que el código agrega al historial cuando el presupuesto de iteraciones se agota. */
export function buildBudgetNotice(remainingIterations: number): string {
  return `AVISO DEL SISTEMA: te quedan ${remainingIterations} respuestas. No busques más: decide ahora con save_lead o discard_lead los candidatos pendientes y luego termina con tu resumen.`;
}
