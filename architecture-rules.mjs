// Reglas de dependencias entre capas. Fuente única para ESLint (no-restricted-imports)
// y para el test de arquitectura (tests/architecture.test.ts).
// El núcleo es TS puro: no conoce Nest, SDKs de terceros ni capas exteriores.

/** Prefijos de paquetes prohibidos por capa. */
export const FORBIDDEN_PACKAGES = {
  core: [
    '@nestjs/',
    'reflect-metadata',
    'express',
    'groq-sdk',
    '@tavily/',
    '@aws-sdk/',
    '@codegenie/',
  ],
  infrastructure: ['@nestjs/', 'reflect-metadata', 'express', '@codegenie/'],
};

/** Capas (carpetas bajo src/) que cada capa no puede importar. */
export const FORBIDDEN_LAYERS = {
  core: ['infrastructure', 'app'],
  infrastructure: ['app'],
};
