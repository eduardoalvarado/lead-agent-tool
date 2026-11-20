// Fuentes de no determinismo detrás de puertos para que el núcleo sea testeable.

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}
