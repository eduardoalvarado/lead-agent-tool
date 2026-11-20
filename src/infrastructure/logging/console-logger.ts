import type { LogContext, Logger } from '../../core/ports/logger.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Readonly<Record<Level, number>> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Logger legible para la terminal: cada paso del agente en una línea + contexto en JSON. */
export class ConsoleLogger implements Logger {
  constructor(private readonly minLevel: Level = 'info') {}

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  private write(level: Level, message: string, context?: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const time = new Date().toISOString().slice(11, 19);
    const details = context ? ` ${JSON.stringify(context)}` : '';
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(`${time} ${level.toUpperCase().padEnd(5)} ${message}${details}\n`);
  }
}
