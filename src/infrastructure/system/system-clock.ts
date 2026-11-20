import type { Clock } from '../../core/ports/system.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
