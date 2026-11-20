/** Mensaje legible de un error desconocido lanzado por un SDK o por `fetch`. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
