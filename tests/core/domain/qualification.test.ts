import { describe, expect, it } from 'vitest';
import type { LeadContact } from '../../../src/core/domain/lead.js';
import {
  QUALIFICATION_MAX,
  type QualificationSignals,
  scoreQualification,
} from '../../../src/core/domain/qualification.js';

const strong: QualificationSignals = {
  sectorMatch: 'exact',
  locationEvidence: 'confirmed',
  maturitySignals: ['2 sedes', '12 especialistas', 'desde 2010'],
};
const fullContact: LeadContact = {
  website: 'https://a.pe',
  email: 'hola@a.pe',
  phone: '(01) 241-7788',
  address: 'Av. Benavides 1920',
};

describe('scoreQualification', () => {
  it('da el máximo (100) con todas las señales y datos de contacto', () => {
    const { score, breakdown } = scoreQualification(strong, fullContact);

    expect(breakdown).toEqual(QUALIFICATION_MAX);
    expect(score).toBe(100);
  });

  it('calcula la contactabilidad desde los datos: teléfono + dirección = 15 (caso Andina Creativa)', () => {
    const contact = { ...fullContact, email: null };

    const { breakdown } = scoreQualification(strong, contact);

    expect(breakdown.contactability).toBe(15);
    expect(breakdown.legitimacy).toBe(25);
  });

  it('sin dirección pierde puntos de legitimidad y de contactabilidad', () => {
    const contact = { ...fullContact, phone: null, address: null };

    expect(scoreQualification(strong, contact).breakdown).toMatchObject({
      legitimacy: 15,
      contactability: 10,
    });
  });

  it('puntúa sector afín y ubicación inferida por debajo de los confirmados', () => {
    const weak: QualificationSignals = {
      sectorMatch: 'related',
      locationEvidence: 'inferred',
      maturitySignals: [],
    };

    expect(scoreQualification(weak, fullContact).breakdown).toMatchObject({ fit: 15, maturity: 0 });
  });

  it('cuenta señales de madurez distintas, con un máximo de 3', () => {
    const repeated = { ...strong, maturitySignals: ['2 sedes', '2 sedes', 'a', 'b', 'c'] };

    expect(scoreQualification(repeated, fullContact).breakdown.maturity).toBe(15);
    expect(
      scoreQualification({ ...strong, maturitySignals: ['2 sedes', '2 sedes'] }, fullContact)
        .breakdown.maturity,
    ).toBe(5);
  });

  it('es determinista y explica cada criterio en la justificación', () => {
    const first = scoreQualification(strong, { ...fullContact, email: null });
    const second = scoreQualification(strong, { ...fullContact, email: null });

    expect(first).toEqual(second);
    expect(first.reason).toBe(
      'Encaje 35 (sector exacto, ubicación confirmada) · Legitimidad 25 (web propia, dirección física) · Contactabilidad 15 (teléfono, dirección) · Madurez 15 (2 sedes; 12 especialistas; desde 2010)',
    );
  });
});
