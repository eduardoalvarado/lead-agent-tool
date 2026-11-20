import type { Lead, LeadCandidate } from '../../src/core/domain/lead.js';
import type { LeadRepository, SaveLeadResult } from '../../src/core/ports/lead-repository.js';
import type {
  LLMProvider,
  LlmCompletion,
  LlmCompletionRequest,
  ToolCall,
} from '../../src/core/ports/llm-provider.js';
import type { LogContext, Logger } from '../../src/core/ports/logger.js';
import type { Clock } from '../../src/core/ports/system.js';

/** LLM con guion: devuelve las respuestas en orden y registra cada request recibida. */
export class ScriptedLlm implements LLMProvider {
  readonly requests: LlmCompletionRequest[] = [];

  private readonly script: LlmCompletion[];

  constructor(script: readonly LlmCompletion[]) {
    this.script = [...script];
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const next = this.script.shift();
    if (!next) throw new Error('ScriptedLlm: guion agotado');
    return next;
  }
}

export function toolCall(name: string, args: unknown, id = `call-${name}`): ToolCall {
  return { id, name, arguments: typeof args === 'string' ? args : JSON.stringify(args) };
}

export function callTools(...toolCalls: ToolCall[]): LlmCompletion {
  return { content: null, reasoning: null, toolCalls };
}

export function answer(content: string): LlmCompletion {
  return { content, reasoning: null, toolCalls: [] };
}

export class FakeLeadRepository implements LeadRepository {
  readonly saved: Lead[] = [];

  async save(lead: Lead): Promise<SaveLeadResult> {
    if (this.saved.some((existing) => existing.id === lead.id)) return 'duplicate';
    this.saved.push(lead);
    return 'created';
  }

  async findAll(): Promise<Lead[]> {
    return [...this.saved];
  }
}

export class SilentLogger implements Logger {
  readonly entries: { level: string; message: string; context?: LogContext }[] = [];

  debug(message: string, context?: LogContext): void {
    this.entries.push({ level: 'debug', message, context });
  }

  info(message: string, context?: LogContext): void {
    this.entries.push({ level: 'info', message, context });
  }

  warn(message: string, context?: LogContext): void {
    this.entries.push({ level: 'warn', message, context });
  }

  error(message: string, context?: LogContext): void {
    this.entries.push({ level: 'error', message, context });
  }
}

export const FIXED_DATE = new Date('2026-11-20T10:00:00.000Z');

export const fixedClock: Clock = { now: () => FIXED_DATE };

export function buildCandidate(overrides: Partial<LeadCandidate> = {}): LeadCandidate {
  return {
    companyName: 'Clínica Dental Sonrisa Clara',
    subSector: 'Ortodoncia invisible',
    summary: 'Clínica dental en Miraflores especializada en ortodoncia invisible y estética.',
    contact: {
      website: 'https://www.sonrisaclara.pe/',
      email: 'citas@sonrisaclara.pe',
      phone: '(01) 241-7788',
      address: 'Av. Benavides 1920, Miraflores',
    },
    qualificationScore: 85,
    qualificationReason: 'Encaja con el sector, web propia, teléfono y email publicados.',
    confidence: 'high',
    sourceUrl: 'https://sonrisaclara.pe/',
    ...overrides,
  };
}
