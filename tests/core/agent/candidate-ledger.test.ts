import { describe, expect, it } from 'vitest';
import { CandidateLedger } from '../../../src/core/agent/candidate-ledger.js';

describe('CandidateLedger', () => {
  it('devuelve solo las URLs no vistas antes', () => {
    const ledger = new CandidateLedger();
    ledger.registerSeen(['https://a.pe']);
    expect(ledger.registerSeen(['https://a.pe', 'https://b.pe'])).toEqual(['https://b.pe']);
  });

  it('una decisión sobre una empresa cubre todas sus páginas', () => {
    const ledger = new CandidateLedger();
    ledger.registerSeen(['https://a.pe/', 'https://www.a.pe/contacto', 'https://b.pe/']);

    ledger.markDecided('https://a.pe/');

    expect(ledger.pending()).toEqual(['https://b.pe/']);
  });

  it('en agregadores y redes sociales cada URL se decide por separado', () => {
    const ledger = new CandidateLedger();
    ledger.registerSeen([
      'https://www.facebook.com/clinica-a',
      'https://www.facebook.com/clinica-b',
    ]);

    ledger.markDecided('https://www.facebook.com/clinica-a');

    expect(ledger.pending()).toEqual(['https://www.facebook.com/clinica-b']);
  });
});
