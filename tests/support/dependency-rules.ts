import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { FORBIDDEN_LAYERS, FORBIDDEN_PACKAGES } from '../../architecture-rules.mjs';

export type Layer = keyof typeof FORBIDDEN_PACKAGES;

export interface DependencyViolation {
  readonly file: string;
  readonly specifier: string;
}

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

export function extractImportSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map(([, specifier]) => specifier ?? '');
}

function importsForbiddenPackage(layer: Layer, specifier: string): boolean {
  return FORBIDDEN_PACKAGES[layer].some((pkg) => specifier === pkg || specifier.startsWith(pkg));
}

function importsForbiddenLayer(layer: Layer, specifier: string, file: string, srcRoot: string) {
  if (!specifier.startsWith('.')) return false;
  const target = path.relative(srcRoot, path.resolve(path.dirname(file), specifier));
  return FORBIDDEN_LAYERS[layer].some((forbidden) => target.split(path.sep)[0] === forbidden);
}

export function findViolations(
  layer: Layer,
  file: string,
  source: string,
  srcRoot: string,
): DependencyViolation[] {
  return extractImportSpecifiers(source)
    .filter(
      (specifier) =>
        importsForbiddenPackage(layer, specifier) ||
        importsForbiddenLayer(layer, specifier, file, srcRoot),
    )
    .map((specifier) => ({ file, specifier }));
}

export function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => path.join(dir, entry));
}

export function scanLayer(layer: Layer, srcRoot: string): DependencyViolation[] {
  return listTypeScriptFiles(path.join(srcRoot, layer)).flatMap((file) =>
    findViolations(layer, file, readFileSync(file, 'utf8'), srcRoot),
  );
}
