# Plan de trabajo (24 h)

Documento interno de seguimiento. **No es parte del entregable.** Claude Code marca cada bloque como ✅ al terminarlo (lint + tests en verde y commit propuesto).

**Regla:** cada bloque trae sus propios tests unitarios (ver "Calidad de código" en `CLAUDE.md`). El bloque 6 solo agrega el e2e y cubre huecos.

| Bloque | Tiempo | Entregable | Estado |
|---|---|---|---|
| 1. Setup | 1 h | `git init` + `.gitignore`; proyecto NestJS sobre Node 26 con `nest-cli.json` apuntando a `src/app/main.ts`; TS estricto; ESLint (Airbnb) + Prettier + regla `no-restricted-imports` del núcleo; Vitest con `unplugin-swc` (decoradores/metadata para el e2e); `.env.example`; docker-compose (DynamoDB Local); estructura `core/infrastructure/app` | ✅ |
| 2. Núcleo del agente | 3.5 h | Dominio: schema Zod del Lead, tipos, `core/domain/errors`. Puertos: `LLMProvider`, `SearchProvider`, `PageFetcher`, `LeadRepository`, `Logger`. `LeadAgent` (bucle ReAct + guardas + resumen final: guardados/descartados/motivo). Tools `search_web`, `fetch_page`, `save_lead` (error de validación devuelto al LLM). Adaptadores: `MockSearchProvider`, `TavilyProvider`, `GroqProvider`, `HttpPageFetcher`, `InMemoryLeadRepository`. Script de smoke test sin Nest (Groq real + mock/Tavily). Tests unitarios de schema, tools y agente con fakes | ⬜ |
| 3. Prompts + cualificación | 1.5 h | System prompt en `core/agent/prompts/`, reglas anti-alucinación, criterios de cualificación, descripción de tools. Ajuste iterativo con el smoke test sobre datos reales (Tavily) y mock | ⬜ |
| 4. Persistencia | 1.5 h | `DynamoLeadRepository` (PK = dominio normalizado, dedupe, `findAll`), script `db:init`, tests del normalizador de dominio | ⬜ |
| 5. Capa Nest | 1.5 h | Config con Zod, módulos, tokens + factories (composition root), `LeadsController` (`POST /leads/search` síncrono, `GET /leads`) + Swagger, CLI, handler Lambda, `BedrockProvider` (stub documentado) | ⬜ |
| 6. Tests | 1 h | e2e del controller con `@nestjs/testing` + huecos de cobertura del núcleo | ⬜ |
| 7. Diagrama | 1 h | Arquitectura AWS generada por Claude (draw.io/Mermaid) y exportada a `docs/architecture.png` (fuente versionada junto al PNG) | ⬜ |
| 8. README final | 1.5 h | Verificar comandos reales, insertar diagrama, resolver los `TODO` del README | ⬜ |
| 9. (Opcional) AWS real | 4–5 h | **Punto de decisión tras el bloque 8: solo si quedan ≥5 h de margen.** `template.yaml` (SAM): API Gateway (API key + throttling), Lambdas `submit`/`agent-worker`/`get-job`, SQS + DLQ, DynamoDB (leads + jobs), Secrets Manager, CloudWatch/X-Ray. Flujo asíncrono `202 + jobId`. Sin margen: entregar solo el template con `sam validate`. Con margen: `sam deploy`, alarma de presupuesto, URL en el README y borrar el stack después de la evaluación | ⬜ |
| Margen | resto | Descanso, imprevistos, pulido | — |

## Cobertura de criterios de evaluación

| Criterio (`docs/reto.md`) | Bloques |
|---|---|
| Diseño agéntico | 2 |
| Prompt engineering | 2 (schema), 3 |
| Arquitectura de software | 1–5 |
| Visión cloud | 7 |

## Checklist de entrega

- [ ] Repositorio público, sin secretos (`.env` en `.gitignore`, `.env.example` completo)
- [ ] `README.md` sin comentarios `TODO` pendientes
- [ ] Comandos del README verificados desde un clon limpio
- [ ] `docs/architecture.png` enlazado en el README
- [ ] Demo en modo mock funcionando sin key de búsqueda
- [ ] Lint, build y tests en verde

## Notas y decisiones durante la implementación

- 2026-11-20 — Revisión del plan: schema Zod movido al bloque 2 (lo necesita `save_lead`); tests por bloque en lugar de solo en el bloque 6; `TavilyProvider`, `HttpPageFetcher` y smoke test adelantados al bloque 2 para validar el tool calling de Groq con datos reales cuanto antes; `BedrockProvider` explícito en el bloque 5; `git init` y `unplugin-swc` en el bloque 1.
- 2026-11-20 — Decisiones de alcance registradas en la sección 2 del README: leads sin web se descartan; endpoint local síncrono + `GET /leads`. El diagrama lo genera Claude.
- 2026-11-20 — Bloque 1: Nest 12 se publica solo como ESM, así que el proyecto es ESM (`"type": "module"`, `module: nodenext`, imports relativos con `.js`), no CommonJS. TypeScript fijado en `~6.0` (typescript-eslint y @nestjs/swagger no soportan TS 7) y ESLint en `^9` (eslint-config-airbnb-extended no soporta ESLint 10). Reglas de capas en `architecture-rules.mjs`, compartidas por ESLint y `tests/architecture.test.ts`. Prettier no toca los `.md`.
