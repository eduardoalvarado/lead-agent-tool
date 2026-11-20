import { describe, expect, it } from 'vitest';
import { LeadAgent } from '../../../src/core/agent/lead-agent.js';
import { SaveLeadTool } from '../../../src/core/agent/tools/save-lead.tool.js';
import { GetJobUseCase } from '../../../src/core/application/get-job.use-case.js';
import { ProcessSearchJobUseCase } from '../../../src/core/application/process-search-job.use-case.js';
import { SubmitSearchJobUseCase } from '../../../src/core/application/submit-search-job.use-case.js';
import { InvalidSearchCriteriaError } from '../../../src/core/domain/errors/invalid-search-criteria.error.js';
import { JobNotFoundError } from '../../../src/core/domain/errors/job-not-found.error.js';
import { LlmProviderError } from '../../../src/core/domain/errors/llm-provider.error.js';
import { PersistenceError } from '../../../src/core/domain/errors/persistence.error.js';
import type { LLMProvider } from '../../../src/core/ports/llm-provider.js';
import {
  answer,
  buildCandidate,
  callTools,
  FakeJobQueue,
  FakeJobRepository,
  FakeLeadRepository,
  fixedClock,
  FIXED_DATE,
  ScriptedLlm,
  SilentLogger,
  toolCall,
} from '../../support/fakes.js';

const criteria = { sector: 'Clínicas dentales', location: 'Lima, Perú' };

function agentWith(llm: LLMProvider) {
  return new LeadAgent(
    llm,
    [new SaveLeadTool(new FakeLeadRepository(), fixedClock)],
    new SilentLogger(),
    {
      maxIterations: 5,
      maxLeads: 5,
    },
  );
}

describe('SubmitSearchJobUseCase', () => {
  it('registra el job como pending y lo encola con sus criterios', async () => {
    const jobs = new FakeJobRepository();
    const queue = new FakeJobQueue();
    const submit = new SubmitSearchJobUseCase(jobs, queue, { generate: () => 'job-1' }, fixedClock);

    const job = await submit.execute({ sector: '  Clínicas dentales ', location: 'Lima, Perú' });

    expect(job).toMatchObject({ jobId: 'job-1', status: 'pending', summary: null, error: null });
    expect(job.createdAt).toBe(FIXED_DATE.toISOString());
    expect(await jobs.find('job-1')).toEqual(job);
    expect(queue.messages).toEqual([{ jobId: 'job-1', criteria }]);
  });

  it('rechaza criterios inválidos sin crear ni encolar nada', async () => {
    const jobs = new FakeJobRepository();
    const queue = new FakeJobQueue();
    const submit = new SubmitSearchJobUseCase(jobs, queue, { generate: () => 'job-1' }, fixedClock);

    await expect(submit.execute({ sector: '', location: 'Lima' })).rejects.toThrow(
      InvalidSearchCriteriaError,
    );
    expect(jobs.jobs.size).toBe(0);
    expect(queue.messages).toHaveLength(0);
  });
});

describe('ProcessSearchJobUseCase', () => {
  async function pendingJob(jobs: FakeJobRepository) {
    const submit = new SubmitSearchJobUseCase(
      jobs,
      new FakeJobQueue(),
      { generate: () => 'job-1' },
      fixedClock,
    );
    await submit.execute(criteria);
  }

  it('ejecuta el agente con el jobId del job y guarda el resumen', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    const llm = new ScriptedLlm([
      callTools(toolCall('save_lead', buildCandidate())),
      answer('Listo.'),
    ]);

    const result = await new ProcessSearchJobUseCase(
      agentWith(llm),
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({
      jobId: 'job-1',
      criteria,
    });

    const job = await jobs.find('job-1');
    expect(result).toBe('completed');
    expect(job?.status).toBe('completed');
    expect(job?.summary).toMatchObject({ jobId: 'job-1', stopReason: 'completed' });
    expect(job?.summary?.savedLeads[0]?.jobId).toBe('job-1');
  });

  it('un fallo del LLM queda en el resumen (llm_error) y el job se completa con lo avanzado', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    const failing: LLMProvider = {
      complete: async () => {
        throw new LlmProviderError('429');
      },
    };

    await new ProcessSearchJobUseCase(
      agentWith(failing),
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({
      jobId: 'job-1',
      criteria,
    });

    expect((await jobs.find('job-1'))?.summary).toMatchObject({
      stopReason: 'llm_error',
      error: '429',
    });
  });

  it('un error dentro de un tool vuelve al LLM y no hace fallar el job', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    const llm = new ScriptedLlm([callTools(toolCall('save_lead', buildCandidate()))]);
    const agent = new LeadAgent(
      llm,
      [
        new SaveLeadTool(
          {
            save: async () => {
              throw new InvalidSearchCriteriaError('x');
            },
            findAll: async () => [],
          },
          fixedClock,
        ),
      ],
      new SilentLogger(),
      { maxIterations: 1, maxLeads: 5 },
    );

    const result = await new ProcessSearchJobUseCase(
      agent,
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({
      jobId: 'job-1',
      criteria,
    });

    // El error de un tool vuelve al LLM; el job termina por el límite de iteraciones.
    expect(result).toBe('completed');
    expect((await jobs.find('job-1'))?.summary?.stopReason).toBe('max_iterations');
  });

  it('si no se puede guardar el resultado (error de dominio), marca el job como failed', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    jobs.complete = async () => {
      throw new PersistenceError('DynamoDB no disponible');
    };
    const llm = new ScriptedLlm([answer('Sin candidatos.')]);

    const result = await new ProcessSearchJobUseCase(
      agentWith(llm),
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({
      jobId: 'job-1',
      criteria,
    });

    expect(result).toBe('failed');
    expect(await jobs.find('job-1')).toMatchObject({
      status: 'failed',
      error: 'DynamoDB no disponible',
    });
  });

  it('omite una reentrega de un job ya resuelto (idempotencia)', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    await jobs.fail('job-1', 'previo', FIXED_DATE);
    const llm = new ScriptedLlm([]);

    const result = await new ProcessSearchJobUseCase(
      agentWith(llm),
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({
      jobId: 'job-1',
      criteria,
    });

    expect(result).toBe('skipped');
    expect(llm.requests).toHaveLength(0);
  });

  const buggy: LLMProvider = {
    complete: async () => {
      throw new TypeError('bug');
    },
  };

  it('propaga errores inesperados y deja el job en running mientras queden reintentos', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);

    await expect(
      new ProcessSearchJobUseCase(agentWith(buggy), jobs, fixedClock, new SilentLogger()).execute(
        { jobId: 'job-1', criteria },
        { finalAttempt: false },
      ),
    ).rejects.toThrow(TypeError);
    expect((await jobs.find('job-1'))?.status).toBe('running');
  });

  it('en el último intento marca el job failed sin exponer el detalle y propaga el error (DLQ)', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);

    await expect(
      new ProcessSearchJobUseCase(agentWith(buggy), jobs, fixedClock, new SilentLogger()).execute(
        { jobId: 'job-1', criteria },
        { finalAttempt: true },
      ),
    ).rejects.toThrow(TypeError);
    const job = await jobs.find('job-1');
    expect(job?.status).toBe('failed');
    expect(job?.error).toContain('agotar los reintentos');
    expect(job?.error).not.toContain('bug');
  });

  it('sin contexto de la cola asume un único intento y no deja el job en running', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);

    await expect(
      new ProcessSearchJobUseCase(agentWith(buggy), jobs, fixedClock, new SilentLogger()).execute({
        jobId: 'job-1',
        criteria,
      }),
    ).rejects.toThrow(TypeError);
    expect((await jobs.find('job-1'))?.status).toBe('failed');
  });

  it('pasa el plazo al agente: vencido, el job se completa con time_limit', async () => {
    const jobs = new FakeJobRepository();
    await pendingJob(jobs);
    const llm = new ScriptedLlm([answer('No debería llegar aquí.')]);

    const result = await new ProcessSearchJobUseCase(
      agentWith(llm),
      jobs,
      fixedClock,
      new SilentLogger(),
    ).execute({ jobId: 'job-1', criteria }, { finalAttempt: false, deadline: AbortSignal.abort() });

    expect(result).toBe('completed');
    expect((await jobs.find('job-1'))?.summary?.stopReason).toBe('time_limit');
    expect(llm.requests).toHaveLength(0);
  });
});

describe('GetJobUseCase', () => {
  it('devuelve el job o un error de dominio si no existe', async () => {
    const jobs = new FakeJobRepository();
    const submit = new SubmitSearchJobUseCase(
      jobs,
      new FakeJobQueue(),
      { generate: () => 'job-1' },
      fixedClock,
    );
    await submit.execute(criteria);

    expect((await new GetJobUseCase(jobs).execute('job-1')).status).toBe('pending');
    await expect(new GetJobUseCase(jobs).execute('nope')).rejects.toThrow(JobNotFoundError);
  });
});
