# Plan de trabajo (24 h)

Documento interno de seguimiento. **No es parte del entregable.** Claude Code marca cada bloque como ✅ al terminarlo (lint + tests en verde y commit propuesto).

**Regla:** cada bloque trae sus propios tests unitarios (ver "Calidad de código" en `CLAUDE.md`). El bloque 6 solo agrega el e2e y cubre huecos.

| Bloque | Tiempo | Entregable | Estado |
|---|---|---|---|
| 1. Setup | 1 h | `git init` + `.gitignore`; proyecto NestJS sobre Node 26 con `nest-cli.json` apuntando a `src/app/main.ts`; TS estricto; ESLint (Airbnb) + Prettier + regla `no-restricted-imports` del núcleo; Vitest con `unplugin-swc` (decoradores/metadata para el e2e); `.env.example`; docker-compose (DynamoDB Local); estructura `core/infrastructure/app` | ✅ |
| 2. Núcleo del agente | 3.5 h | Dominio: schema Zod del Lead, tipos, `core/domain/errors`. Puertos: `LLMProvider`, `SearchProvider`, `PageFetcher`, `LeadRepository`, `Logger`. `LeadAgent` (bucle ReAct + guardas + resumen final: guardados/descartados/motivo). Tools `search_web`, `fetch_page`, `save_lead` (error de validación devuelto al LLM). Adaptadores: `MockSearchProvider`, `TavilyProvider`, `GroqProvider`, `HttpPageFetcher`, `InMemoryLeadRepository`. Script de smoke test sin Nest (Groq real + mock/Tavily). Tests unitarios de schema, tools y agente con fakes | ✅ |
| 3. Prompts + cualificación | 1.5 h | System prompt en `core/agent/prompts/`, reglas anti-alucinación, criterios de cualificación, descripción de tools. Ajuste iterativo con el smoke test sobre datos reales (Tavily) y mock | ⬜ |
| 4. Persistencia | 1.5 h | `DynamoLeadRepository` (PK = dominio normalizado, dedupe, `findAll`), script `db:init`, tests del normalizador de dominio | ✅ |
| 5. Capa Nest | 1.5 h | Config con Zod, módulos, tokens + factories (composition root), `LeadsController` (`POST /leads/search` síncrono, `GET /leads`) + Swagger, CLI, handler Lambda, `BedrockProvider` (stub documentado) | ✅ |
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
- 2026-11-20 — Bloque 2: se agrega el tool `discard_lead` (cuarto tool) para que los descartes y su motivo queden estructurados en el resumen final. Guarda en código contra agregadores: `contact.website` no puede ser una red social o directorio conocido (`core/domain/aggregator-domains.ts`), además de la regla en el prompt. `requestedSector`, `location`, `jobId`, `id` y `createdAt` los asigna el código, no el LLM. Los parámetros de los tools se generan desde Zod (`z.toJSONSchema`), una sola fuente. El smoke test corre con `tsx` (`npm run smoke`). En modo mock, `fetch_page` usa `MockPageFetcher` (sin red).
- 2026-11-20 — Bloque 2 (smoke test real): `llama-3.3-70b-versatile` ya no existe en Groq; `qwen/qwen3.8-27b` ignora los resultados de los tools y `gpt-oss-20b` entra en bucles; se usa `openai/gpt-oss-120b`. Este modelo emite un solo tool call por turno y tiende a postergar decisiones, por eso se agregaron guardas deterministas en código (`CandidateLedger`): `search_web` se bloquea si hay resultados sin decidir, `fetch_page` se bloquea si otra empresa leída sigue sin decidir, y avisa "SIN NOVEDADES" ante resultados repetidos. `discard_lead` recibe la `url` descartada. Compactación de observaciones antiguas (las 2 últimas completas) y extractos más cortos por el límite de 8k TPM del free tier. Un fallo del LLM corta con `stopReason: llm_error` y devuelve el resumen parcial (los leads guardados se conservan). Pendiente de decisión: proveedor LLM ante el límite de 200k tokens/día de Groq free y default de `AGENT_MAX_ITERATIONS`.
- 2026-11-20 — Decisión del usuario: LLM por defecto = Claude vía Amazon Bedrock (`BedrockProvider` real con `@anthropic-ai/bedrock-sdk`, endpoint `bedrock-mantle`, `anthropic.claude-haiku-5-5` (elegido por el usuario: extracción y decisiones simples no requieren Opus; mucho menor costo), effort `medium`, thinking adaptativo con resumen para los logs); Groq queda como alternativa. `AGENT_MAX_ITERATIONS` default 20. Claude no acepta `temperature` (se documenta en CLAUDE.md). El historial vuelve intacto a Claude (bloques de thinking vía `providerState` opaco) y la compactación de observaciones solo se activa con Groq. Las credenciales ficticias de DynamoDB Local salen del `.env` (tenían prioridad sobre `aws login`); el adaptador Dynamo las pasará explícitamente en el bloque 4.
- 2026-11-20 — La cuenta AWS del usuario no tiene acceso a Claude en Bedrock (Anthropic exige autorización de cuenta empresarial). Decisión del usuario: Groq como proveedor por defecto en la PoC, manteniendo el núcleo agnóstico; `BedrockProvider` queda como adaptador de producción (código y tests del mapper listos, sin validar contra AWS). Pendiente: la cuota diaria de Groq (200k tokens) limita las ejecuciones reales; el bloque 3 debe ajustar prompts con pocas ejecuciones.
- 2026-11-20 — Bloque 4: `save` con escritura condicional (`attribute_not_exists(id)`) → dedupe atómico; `findAll` con Scan paginado + validación Zod (en producción: GSI por jobId/fecha). Credenciales ficticias solo para DynamoDB Local, inyectadas en la fábrica del cliente. Test de integración opcional (`npm run test:integration`, requiere Docker). Se descartó `aws-sdk-client-mock` por incompatibilidad de tipos con el SDK actual; se usa un fake de `send()`.
- 2026-11-20 — Bloque 5: config validada con Zod (`loadAppConfig`, variables vacías = ausentes, falla rápido al arrancar) y `.env` cargado con `process.loadEnvFile` nativo (sin dotenv) → `engines.node` pasa a `>=24.10`. Registro `LLM_ADAPTERS` en `app/providers` como único punto para conectar un LLM nuevo. `ListLeadsUseCase` ordena por `qualificationScore`. Errores de dominio → HTTP en `DomainExceptionFilter` (400/502/503). `npm run agent` compila antes (`preagent`) porque Nest necesita la metadata de decoradores. Verificado: Swagger, validación 400, `GET /leads` contra DynamoDB Local, `POST /leads/search` (corte `llm_error` por cuota de Groq) y handler Lambda con eventos de API Gateway v2.
