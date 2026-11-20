import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../core/ports/system.js';

export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
