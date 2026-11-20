import { describe, expect, it } from 'vitest';
import { handler as apiHandler } from '../../src/app/lambda.js';
import { handler as workerHandler } from '../../src/app/worker.js';

// El runtime Node.js 24 de Lambda rechaza handlers con callback (3 parámetros) al iniciar.
describe('Handlers de Lambda', () => {
  it.each([
    ['api', apiHandler],
    ['worker', workerHandler],
  ])('el handler %s es async y no declara callback', (_name, handler) => {
    expect(handler.length).toBeLessThanOrEqual(2);
    expect(handler.constructor.name).toBe('AsyncFunction');
  });
});
