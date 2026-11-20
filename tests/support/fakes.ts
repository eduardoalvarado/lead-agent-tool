import type { Job, JobMessage } from '../../src/core/domain/job.js';
import type { Lead, LeadCandidate } from '../../src/core/domain/lead.js';
import type { AgentRunSummary } from '../../src/core/domain/run-summary.js';
import type { JobQueue } from '../../src/core/ports/job-queue.js';
import type { JobRepository } from '../../src/core/ports/job-repository.js';
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
    qualificationSignals: {
      sectorMatch: 'exact',
      locationEvidence: 'confirmed',
      maturitySignals: ['2 sedes'],
    },
    confidence: 'high',
    sourceUrl: 'https://sonrisaclara.pe/',
    ...overrides,
  };
}

export class FakeJobRepository implements JobRepository {
  readonly jobs = new Map<string, Job>();

  async create(job: Job): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async find(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async markRunning(jobId: string, at: Date): Promise<void> {
    this.patch(jobId, { status: 'running', updatedAt: at.toISOString() });
  }

  async complete(jobId: string, summary: AgentRunSummary, at: Date): Promise<void> {
    this.patch(jobId, {
      status: 'completed',
      updatedAt: at.toISOString(),
      summary: {
        ...summary,
        savedLeads: [...summary.savedLeads],
        discarded: [...summary.discarded],
      },
    });
  }

  async fail(jobId: string, error: string, at: Date): Promise<void> {
    this.patch(jobId, { status: 'failed', updatedAt: at.toISOString(), error });
  }

  private patch(jobId: string, fields: Partial<Job>): void {
    const job = this.jobs.get(jobId);
    if (job) this.jobs.set(jobId, { ...job, ...fields });
  }
}

export class FakeJobQueue implements JobQueue {
  readonly messages: JobMessage[] = [];

  async enqueue(message: JobMessage): Promise<void> {
    this.messages.push(message);
  }
}
