import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC en lugar del transformador por defecto: emite la metadata de decoradores que
// necesita la inyección de dependencias de Nest en el test e2e del controller.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
