import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findViolations, scanLayer } from './support/dependency-rules.js';

const SRC_ROOT = path.resolve(import.meta.dirname, '../src');
const coreFile = path.join(SRC_ROOT, 'core/agent/lead-agent.ts');
const infraFile = path.join(SRC_ROOT, 'infrastructure/llm/openai-compatible-provider.ts');

describe('Regla de dependencias entre capas', () => {
  describe('detector de violaciones', () => {
    it('detecta Nest, SDKs y capas exteriores importados desde el núcleo', () => {
      const source = [
        "import { Injectable } from '@nestjs/common';",
        "import OpenAI from 'openai';",
        "import { DynamoDBClient } from '@aws-sdk/client-dynamodb';",
        "import { OpenAICompatibleProvider } from '../../infrastructure/llm/openai-compatible-provider.js';",
        "import { AppModule } from '../../app/app.module.js';",
      ].join('\n');

      expect(findViolations('core', coreFile, source, SRC_ROOT)).toHaveLength(5);
    });

    it('permite al núcleo importar zod y módulos del propio núcleo', () => {
      const source = [
        "import { z } from 'zod';",
        "import type { LLMProvider } from '../ports/llm-provider.js';",
      ].join('\n');

      expect(findViolations('core', coreFile, source, SRC_ROOT)).toEqual([]);
    });

    it('permite a infraestructura usar SDKs y puertos del núcleo, pero no Nest ni app', () => {
      const source = [
        "import OpenAI from 'openai';",
        "import type { LLMProvider } from '../../core/ports/llm-provider.js';",
        "import { Injectable } from '@nestjs/common';",
        "import { AppModule } from '../../app/app.module.js';",
      ].join('\n');

      expect(findViolations('infrastructure', infraFile, source, SRC_ROOT)).toEqual([
        { file: infraFile, specifier: '@nestjs/common' },
        { file: infraFile, specifier: '../../app/app.module.js' },
      ]);
    });
  });

  describe('código fuente actual', () => {
    it.each(['core', 'infrastructure'] as const)('src/%s respeta la regla', (layer) => {
      expect(scanLayer(layer, SRC_ROOT)).toEqual([]);
    });
  });
});
