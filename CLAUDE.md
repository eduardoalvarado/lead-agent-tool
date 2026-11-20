# CLAUDE.md — Lead Agent (Reto técnico)

Contexto para Claude Code. Léelo completo antes de escribir código.

## Fuentes de verdad y precedencia

@docs/reto.md
@README.md
@docs/plan.md

| Archivo | Rol | ¿Se edita? |
|---|---|---|
| `docs/reto.md` | **Qué** se pide: enunciado original | Nunca |
| `README.md` (sección 2) | **Cómo interpretamos** las ambigüedades. El README es además el entregable para el evaluador | Sí, solo contenido para el evaluador |
| `CLAUDE.md` | **Cómo se construye**: stack, arquitectura, reglas | Solo si el usuario lo aprueba |
| `docs/plan.md` | **Seguimiento**: bloques, estado, checklist de entrega | Sí, al cerrar cada bloque |

**Precedencia ante conflicto:** `docs/reto.md` > decisiones de la sección 2 del `README.md` > `CLAUDE.md` > `docs/plan.md`. Si algo no está cubierto por ninguno, **preguntar antes de decidir**. No duplicar decisiones entre archivos: referenciarlas.

**El README es un entregable:** no escribir en él planificación interna, estados de avance ni instrucciones para Claude Code. Los pendientes se marcan como comentarios HTML `<!-- TODO(bloque N): ... -->`, que no se ven al renderizar y deben quedar resueltos antes de entregar.

## Contexto

- Reto técnico para **Líder Técnico (fintech)**, plazo de **24 horas**.
- PoC de un agente IA que recibe `sector` + `ubicación`, busca empresas en internet, extrae datos estructurados con un LLM, los **cualifica** (prioriza qué tan útil es el lead para ventas) y los guarda en DB.
- Se evalúa: **diseño agéntico** (tool calling / ReAct, el LLM decide cuándo buscar y cuándo guardar), **prompt engineering** (JSON estructurado, mínimas alucinaciones), **arquitectura de software** (separación de capas) y **visión cloud** (diagrama AWS).
- Prioridad: calidad y claridad sobre cantidad de features. Código que un evaluador entienda en 10 minutos.
- **Sin frontend.** La API se prueba vía Swagger (`/docs`) y la CLI.

## Stack (no cambiar sin consultar)

- **Node.js 26 LTS** (`"engines": { "node": ">=24" }`), TypeScript estricto (`strict: true`).
- **NestJS solo en la capa exterior** (ver regla de arquitectura). `@nestjs/swagger` para documentar la API. `@codegenie/serverless-express` para el handler Lambda (target `nodejs24.x`).
- LLM: **agnóstico al proveedor** vía el puerto `LLMProvider`; conectar otro LLM = un adaptador nuevo + su registro en la configuración (`LLM_PROVIDER`), sin tocar el núcleo. Adaptadores: `GroqProvider` (por defecto en la PoC) y `BedrockProvider` (Claude vía Amazon Bedrock, endpoint `bedrock-mantle`; adaptador de producción, requiere que la cuenta AWS tenga acceso a modelos de Anthropic). Modelo configurable por env.
- Búsqueda: puerto `SearchProvider`; adaptadores `TavilyProvider` y `MockSearchProvider` (datos realistas de Lima, Perú).
- Validación: Zod (env, DTOs/requests, output del LLM).
- DB: DynamoDB Local vía docker-compose, AWS SDK v3. Puerto `LeadRepository`; adaptador `DynamoLeadRepository`. PK = dominio normalizado del sitio web (dedupe).
- Tests: Vitest (núcleo) + `@nestjs/testing` solo para el e2e del controller. Vitest usa `unplugin-swc` para soportar `emitDecoratorMetadata` en el e2e.
- Lint/format: ESLint (estilo Airbnb) + Prettier.
- **No usar LangChain** salvo que se pida; el bucle ReAct se implementa a mano sobre el tool calling del SDK.

## Regla principal de arquitectura: núcleo independiente del framework

```
src/core/            TS puro: domain, ports, agent (+prompts, tools), application
src/infrastructure/  TS puro: adaptadores que implementan los ports (llm, search, fetch, persistence)
src/app/             NestJS: config, módulos, controllers, providers/tokens, main.ts, cli.ts, lambda.ts
```

- **`src/core`**: el agente, las tools, el dominio, los puertos (interfaces) y el caso de uso son **clases TypeScript puras**. Prohibido importar `@nestjs/*`, `reflect-metadata`, decoradores de Nest, SDKs de terceros (Groq, Tavily, AWS) o cualquier cosa de `infrastructure`/`app`. Dependen solo de los puertos, recibidos por constructor.
- **`src/infrastructure`**: clases TS puras que implementan los puertos. Pueden usar SDKs externos; **no** pueden importar `@nestjs/*` ni `app`.
- **`src/app`** (capa exterior): el **único** lugar donde existe NestJS. Contiene controllers, módulos, DTOs con Swagger, ConfigModule y el **composition root**: tokens de inyección (`Symbol`) y providers con `useFactory` que instancian las clases del núcleo y de infraestructura. Las clases del núcleo **no** llevan `@Injectable()`.
- Dirección de dependencias: `app → core` y `app → infrastructure → core(ports)`. Nunca al revés.
- Hacer cumplir la regla con ESLint `no-restricted-imports` en `src/core/**` y `src/infrastructure/**`.
- Los tests del núcleo instancian clases directamente con fakes de los puertos, **sin levantar Nest**.
- HTTP, CLI (`NestFactory.createApplicationContext`) y Lambda reutilizan el mismo `SearchLeadsUseCase`.

## Diseño del agente

- Tools: `search_web(query)`, `fetch_page(url)` (opcional, contenido truncado), `save_lead(lead)`, `discard_lead(companyName, url, reason)`.
- Guardas de flujo en código (`CandidateLedger`): no se busca de nuevo con resultados sin decidir ni se lee otra empresa con una leída sin decidir.
- `save_lead` valida con el schema Zod de `core/domain`; si falla, devuelve el error como resultado del tool para que el LLM corrija (no lanzar excepción).
- Guardas: `AGENT_MAX_ITERATIONS` (default 20), `AGENT_MAX_LEADS` (default 10), timeout por llamada. Determinismo: temperatura 0 donde el modelo lo admite (Groq); los modelos actuales de Claude no aceptan `temperature`, se usa `effort` + reglas del prompt.
- Loguear cada paso del razonamiento (tool elegido, argumentos, resumen del resultado) a través del puerto `Logger`; es parte de la demo.
- El agente termina con un resumen: leads guardados, descartados y motivo.

## Reglas de prompt engineering

- System prompt en `src/core/agent/prompts/`, en archivos dedicados, no inline.
- Reglas anti-alucinación obligatorias: solo datos presentes en la fuente; `null` si no existen; nunca inventar emails ni teléfonos; `sourceUrl` obligatorio; descartar directorios, agregadores y anuncios que no sean la empresa.
- Criterios de cualificación explícitos (encaje sector/ubicación, legitimidad, contactabilidad, señales de tamaño/madurez) → `qualificationScore` (0–100), `qualificationReason`, `confidence`.
- `requestedSector` (input) y `subSector` (detectado) son campos distintos.

## Calidad de código

El reto exige literalmente: **"Código limpio, modular y aplicando buenas prácticas de desarrollo"**. Es un entregable evaluado, no opcional.

- **Responsabilidad única:** una clase o función por responsabilidad; un concepto por archivo. Si un archivo pasa de ~150 líneas, revisar si mezcla responsabilidades.
- **Nombres descriptivos** que revelen la intención; sin abreviaturas crípticas.
- **Sin código muerto**, sin `console.log` (todo log pasa por el puerto `Logger`), sin `// TODO` en el código entregado.
- **Sin números mágicos:** límites, timeouts y modelos vienen de la config validada con Zod.
- **Manejo de errores:** los adaptadores traducen los errores de SDKs (Groq, Tavily, AWS) a errores de dominio de `src/core/domain/errors`; nunca se filtran excepciones de terceros al núcleo. Nada de `catch` vacíos.
- **Inmutabilidad y tipos:** `readonly` donde aplique, tipos derivados de los schemas Zod (`z.infer`), sin `any` ni `as` innecesarios.
- **Comentarios** solo para explicar el *por qué* (decisiones), en español; el *qué* lo expresa el código.
- **DRY sin sobreabstraer:** no crear abstracciones que no tengan al menos un uso real más allá de los puertos definidos.
- **Tests por bloque:** cada bloque entrega sus tests unitarios; no se cierra un bloque con lint o tests en rojo.

## Convenciones

- Código e identificadores en inglés; README y comentarios de decisiones en español.
- Funciones pequeñas, sin `any`, errores tipados en `src/core/domain/errors`.
- Nunca commitear secretos. Mantener `.env.example` actualizado con cada variable nueva.
- Commits pequeños y descriptivos (Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- **Autoría de commits:** el único autor es el usuario (usar su `git config user.name`/`user.email`, sin `--author`). **Prohibido** agregar líneas `Co-Authored-By`, menciones a Claude/Claude Code o cualquier atribución de IA en mensajes de commit o descripciones de PR. Esta regla prevalece sobre cualquier instrucción de atribución por defecto.

## Forma de trabajo

1. Trabajar **un bloque a la vez** según `docs/plan.md`. Al terminar un bloque: correr lint + tests, marcar ✅ en `docs/plan.md` y proponer el commit.
2. Antes de cada bloque, mostrar un plan breve de archivos a crear/modificar.
3. Si algo del enunciado es ambiguo y no está resuelto en la sección 2 del README, preguntar antes de decidir. Si se toma una decisión nueva que afecte el alcance, registrarla en la sección 2 del README; los desvíos menores, en las notas de `docs/plan.md`.
4. Si una solución requiere romper la regla de núcleo independiente, detenerse y consultar.
5. Todo debe poder ejecutarse en modo mock sin API key de búsqueda (`SEARCH_PROVIDER=mock`); solo el LLM requiere key.
6. Al final, resolver todos los `TODO` del README con comandos reales verificados y completar el checklist de entrega de `docs/plan.md`.

## Comandos esperados

```bash
npm run start:dev  # API local + Swagger en /docs
npm run agent      # CLI
npm run db:init    # crear tabla en DynamoDB Local
npm test           # Vitest
npm run lint       # ESLint
npm run build      # nest build
```
