import { describe, expect, it } from 'vitest';
import { PageFetchError } from '../../src/core/domain/errors/page-fetch.error.js';
import { extractTitle, htmlToText } from '../../src/infrastructure/fetch/html-to-text.js';
import { MockPageFetcher } from '../../src/infrastructure/fetch/mock-page-fetcher.js';
import {
  fromGroqToolCall,
  toGroqMessage,
} from '../../src/infrastructure/llm/groq-message.mapper.js';
import { InMemoryLeadRepository } from '../../src/infrastructure/persistence/in-memory-lead-repository.js';
import { MockSearchProvider } from '../../src/infrastructure/search/mock-search-provider.js';
import { buildLead } from '../support/lead-fixtures.js';

describe('MockSearchProvider', () => {
  const provider = new MockSearchProvider();

  it('devuelve resultados del sector ignorando tildes y mayúsculas', async () => {
    const results = await provider.search('CLÍNICAS DENTALES en Lima', 10);
    expect(results.length).toBeGreaterThan(3);
    expect(results.every((result) => result.url.startsWith('https://'))).toBe(true);
  });

  it('respeta el máximo de resultados', async () => {
    expect(await provider.search('agencias de marketing Lima', 2)).toHaveLength(2);
  });

  it('prioriza los resultados que coinciden con la consulta', async () => {
    const [first] = await provider.search('marketing branding San Isidro', 5);
    expect(first?.url).toBe('https://andinacreativa.pe/');
  });

  it('no devuelve nada para sectores fuera del dataset', async () => {
    expect(await provider.search('estudios de abogados Lima', 5)).toEqual([]);
  });
});

describe('MockPageFetcher', () => {
  it('sirve el texto completo de la página aunque la URL no tenga barra final', async () => {
    const page = await new MockPageFetcher().fetch('https://pulsodigital-agencia.pe/contacto/');
    expect(page.text).toContain('hola@pulsodigital-agencia.pe');
  });

  it('falla con un error de dominio para URLs desconocidas', async () => {
    await expect(new MockPageFetcher().fetch('https://desconocido.pe')).rejects.toThrow(
      PageFetchError,
    );
  });
});

describe('htmlToText', () => {
  it('quita scripts, estilos y etiquetas y conserva saltos de bloque', () => {
    const html =
      '<html><head><title>Contacto &amp; Citas</title><style>p{}</style></head><body>' +
      '<script>alert(1)</script><h1>Clínica</h1><p>Tel:&nbsp;(01) 241-7788</p></body></html>';

    expect(extractTitle(html)).toBe('Contacto & Citas');
    expect(htmlToText(html)).toBe('Contacto & Citas\nClínica\nTel: (01) 241-7788');
  });
});

describe('Groq message mapper', () => {
  it('traduce mensajes de assistant con tool calls al formato de Groq', () => {
    const message = toGroqMessage({
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'c1', name: 'search_web', arguments: '{"query":"x"}' }],
    });
    expect(message).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: { name: 'search_web', arguments: '{"query":"x"}' },
        },
      ],
    });
  });

  it('traduce resultados de tool y tool calls de vuelta al núcleo', () => {
    expect(toGroqMessage({ role: 'tool', toolCallId: 'c1', content: 'ok' })).toEqual({
      role: 'tool',
      tool_call_id: 'c1',
      content: 'ok',
    });
    expect(
      fromGroqToolCall({ id: 'c1', type: 'function', function: { name: 'n', arguments: '{}' } }),
    ).toEqual({ id: 'c1', name: 'n', arguments: '{}' });
  });
});

describe('InMemoryLeadRepository', () => {
  it('deduplica por id', async () => {
    const repository = new InMemoryLeadRepository();

    expect(await repository.save(buildLead())).toBe('created');
    expect(await repository.save(buildLead())).toBe('duplicate');
    expect(await repository.findAll()).toHaveLength(1);
  });
});
