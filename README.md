# Lead Agent — Agente IA para Extracción y Cualificación de Leads

Prueba de concepto (PoC) de un agente IA que, a partir de un **sector empresarial** y una **ubicación**, busca empresas en fuentes públicas de internet, extrae y estructura sus datos con un LLM, los cualifica y los guarda en una base de datos para el equipo comercial.

---

## 1. Finalidad funcional

Hoy la prospección es manual: un vendedor busca "clínicas dentales en Lima", entra a cada web, copia nombre, actividad y contacto a un Excel. Este agente automatiza ese flujo:

1. Recibe `sector` + `ubicación` (CLI o endpoint HTTP).
2. El LLM decide qué buscar y ejecuta búsquedas web (tool calling).
3. Analiza los resultados, descarta lo que no es una empresa real del sector.
4. **Extrae** datos estructurados (JSON validado).
5. **Cualifica** cada lead: estima qué tan probable es que sea un cliente útil para priorizar el contacto.
6. Decide guardar cada lead válido en la base de datos (deduplicado por dominio).

---

## 2. Decisiones de alcance (ambigüedades del enunciado resueltas)

| Ambigüedad | Decisión |
|---|---|
| "Guardar automáticamente" vs. "el LLM decide cuándo guardar" | Guardar es un **tool** (`save_lead`) que el LLM invoca; el código valida con Zod antes de persistir. Si la validación falla, el error vuelve al LLM para que se autocorrija. |
| "Cualificación" no está definida | Se cualifica con señales observables en fuentes públicas: encaje con sector y ubicación, legitimidad (empresa real vs. directorio/anuncio), contactabilidad y señales de tamaño/madurez. Resultado: `qualificationScore` (0–100), `qualificationReason`, `confidence`. |
| "Sector" es input y output | En la salida se guarda `subSector` detectado (ej. "Ortodoncia" dentro de "Clínicas dentales"), además del sector solicitado. |
| "Posibles datos de contacto" invita a alucinar | Solo se guardan contactos que aparezcan **literalmente** en la fuente; si no, `null`. `sourceUrl` es obligatorio. |
| B2C implica datos personales | Foco en **B2B**. Tratamiento de datos personales (Ley 29733, Perú) queda documentado en limitaciones. |
| Lead sin sitio web | Se **descarta**: la PK es el dominio normalizado del sitio (deduplicación) y un lead B2B sin web tiene bajo valor comercial. Queda reflejado en el resumen del agente como descartado con su motivo. |
| ¿Endpoint síncrono o asíncrono? | En la PoC local, `POST /leads/search` es **síncrono** (devuelve el resumen al terminar) y `GET /leads` lista los leads guardados para verificar el almacenamiento. En producción el flujo es asíncrono (`202` + `jobId`, ver 3.2). |
| ¿Interfaz frontend? | **Fuera de alcance**: no es entregable ni criterio de evaluación. Se expone **Swagger** (`/docs`) para probar la API y la CLI muestra el razonamiento del agente. |

---

## 3. Arquitectura

### 3.1 Principio: núcleo independiente del framework

El **núcleo** (dominio, puertos/interfaces, agente, tools y caso de uso) son **clases TypeScript puras**: no importan `@nestjs/*` ni SDKs de infraestructura. **NestJS vive solo en la capa exterior**: controllers, módulos y conexión de dependencias (composition root). Los adaptadores (Groq, Tavily, DynamoDB) también son clases puras que implementan los puertos; Nest únicamente los instancia e inyecta.

Beneficios: el agente se testea sin levantar Nest, el framework es reemplazable y el mismo núcleo se reutiliza en HTTP, CLI y Lambda.

```
┌──────────────────────── Capa exterior (NestJS) ────────────────────────┐
│  HTTP Controller · CLI · Lambda handler · Módulos · Providers/tokens   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ inyecta implementaciones
┌───────────────────────────────▼──── Núcleo (TS puro) ──────────────────┐
│  SearchLeadsUseCase ─► LeadAgent (bucle ReAct + tool calling)          │
│                          ├─ search_web ─► SearchProvider (puerto)      │
│                          ├─ fetch_page ─► PageFetcher (puerto)         │
│                          └─ save_lead  ─► Zod ► LeadRepository (puerto)│
│                        LLMProvider (puerto)                            │
└───────────────────────────────▲────────────────────────────────────────┘
                                │ implementan los puertos
┌───────────────────────────────┴──── Adaptadores (TS puro) ─────────────┐
│  GroqProvider · BedrockProvider (stub) · TavilyProvider · MockSearch   │
│  DynamoLeadRepository (DynamoDB Local en Docker)                       │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Producción en AWS

<!-- TODO(bloque 7): insertar ![Arquitectura AWS](docs/architecture.png) -->

```
Cliente ─► API Gateway ─► Lambda "submit" ─► SQS ─► Lambda "agent-worker" ─► Amazon Bedrock (Claude)
              │               (202 + jobId)    │            │                └► Tavily (key en Secrets Manager)
              │                                DLQ          └► DynamoDB (leads + jobs)
              └─► Lambda "get-job" (GET /jobs/{id}) ─► DynamoDB
Observabilidad: CloudWatch Logs/Metrics + X-Ray · Seguridad: IAM roles, Secrets Manager
Runtime: nodejs24.x (migración a nodejs26.x cuando salga de preview en Lambda)
```

**Por qué asíncrono:** un agente puede tardar minutos; API Gateway corta a los 29 s. Se responde `202` con `jobId` y se consulta el estado.

### 3.3 Estructura del código

```
src/
├── core/                         # TS puro — prohibido importar @nestjs/* o SDKs
│   ├── domain/                   # Lead schema (Zod), tipos, errores de dominio
│   ├── ports/                    # LLMProvider, SearchProvider, PageFetcher, LeadRepository, Logger
│   ├── agent/                    # LeadAgent (bucle ReAct), prompts/, tools/
│   └── application/              # SearchLeadsUseCase
├── infrastructure/               # TS puro — adaptadores que implementan los puertos
│   ├── llm/                      # GroqProvider, BedrockProvider (stub)
│   ├── search/                   # TavilyProvider, MockSearchProvider
│   ├── fetch/                    # HttpPageFetcher
│   └── persistence/              # DynamoLeadRepository
└── app/                          # NestJS — capa exterior
    ├── config/                   # ConfigModule + validación de env con Zod
    ├── leads/                    # LeadsModule, LeadsController, DTOs, Swagger
    ├── providers/                # tokens de inyección y factories (composition root)
    ├── main.ts                   # bootstrap HTTP
    ├── cli.ts                    # createApplicationContext
    └── lambda.ts                 # handler (@codegenie/serverless-express)
tests/
docs/
```

La regla de dependencias se hace cumplir con ESLint (`no-restricted-imports` en `src/core` e `src/infrastructure` para `@nestjs/*`).

---

## 4. Stack y decisiones técnicas

| Componente | Elección | Motivo |
|---|---|---|
| Runtime | Node.js 26 LTS (`engines: >=24`) | LTS activo hasta 2029. En Lambda se apunta a `nodejs24.x` (GA) hasta que `nodejs26.x` salga de preview. |
| Lenguaje | TypeScript estricto | Tipado end-to-end. |
| Framework | NestJS (solo capa exterior) | Módulos y DI expresan la separación de capas; el núcleo queda agnóstico. Trade-off: cold start en Lambda, mitigado con `@codegenie/serverless-express` y bundle optimizado. |
| Agente | Bucle ReAct propio sobre tool calling del SDK | ~100 líneas, control total y transparente del razonamiento; evita la caja negra de un framework. Alternativa: LangGraph.js. |
| LLM (local) | Groq (modelo open source con tool calling) | Costo cero para la PoC, baja latencia. |
| LLM (producción) | Claude vía Amazon Bedrock | IAM en lugar de API keys, datos dentro de AWS, facturación y monitoreo centralizados (clave en fintech). |
| Búsqueda | Tavily + `MockSearchProvider` | Devuelve contenido limpio para LLMs; el mock permite tests/demos sin key. |
| Validación | Zod | Un solo esquema para validar output del LLM, env y requests. |
| Base de datos | DynamoDB Local (Docker) | Coherente con el diseño serverless; PK por dominio para deduplicar. Detrás de `LeadRepository`. |
| Documentación API | `@nestjs/swagger` | Interfaz interactiva para el evaluador sin construir un frontend. |

---

## 5. Modelo de datos (Lead)

```json
{
  "id": "clinicadental-ejemplo.pe",
  "companyName": "Clínica Dental Ejemplo",
  "requestedSector": "Clínicas dentales",
  "subSector": "Ortodoncia y estética dental",
  "location": "Lima, Perú",
  "summary": "Clínica en Miraflores especializada en ortodoncia invisible…",
  "contact": {
    "website": "https://clinicadental-ejemplo.pe",
    "email": null,
    "phone": "+51 1 555 0000",
    "address": "Av. Ejemplo 123, Miraflores"
  },
  "qualificationScore": 78,
  "qualificationReason": "Coincide con el sector, tiene web activa y teléfono público.",
  "confidence": "high",
  "sourceUrl": "https://…",
  "jobId": "…",
  "createdAt": "2026-11-20T10:00:00Z"
}
```

---

## 6. Instalación y ejecución

<!-- TODO(bloque 8): verificar todos los comandos desde un clon limpio y ajustar. -->

```bash
# Requisitos: Node 26 (o >=24), Docker
git clone <repo> && cd lead-agent
cp .env.example .env          # completar GROQ_API_KEY, TAVILY_API_KEY
docker compose up -d          # DynamoDB Local
npm install
npm run db:init               # crea la tabla

# CLI
npm run agent -- --sector "Clínicas dentales" --location "Lima, Perú"

# Modo mock (sin key de búsqueda)
SEARCH_PROVIDER=mock npm run agent -- --sector "Agencias de marketing" --location "Lima, Perú"

# API + Swagger en http://localhost:3000/docs
npm run start:dev
curl -X POST http://localhost:3000/leads/search \
  -H "Content-Type: application/json" \
  -d '{"sector":"Clínicas dentales","location":"Lima, Perú"}'

# Tests
npm test
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP (default 3000) |
| `LLM_PROVIDER` | `groq` \| `bedrock` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Credenciales y modelo de Groq |
| `SEARCH_PROVIDER` | `tavily` \| `mock` |
| `TAVILY_API_KEY` | Key de Tavily |
| `DYNAMO_ENDPOINT` / `DYNAMO_TABLE` | DynamoDB Local y nombre de tabla |
| `AGENT_MAX_ITERATIONS` / `AGENT_MAX_LEADS` | Límites del agente |

---

## 7. Prompt engineering (principios)

- Rol y objetivo explícitos; el LLM planifica queries a partir de sector + ubicación.
- Reglas anti-alucinación: solo datos presentes en la fuente, `null` si no existe, `sourceUrl` obligatorio, nunca inventar emails/teléfonos.
- Criterios de cualificación explícitos (encaje sector/ubicación, legitimidad, contactabilidad, señales de tamaño).
- Salida forzada vía schema del tool `save_lead` (JSON) + validación Zod con reintento.
- Temperatura 0, máximo de iteraciones y de leads por ejecución.

---

## 8. Limitaciones y mejoras futuras

<!-- TODO(bloque 8): añadir limitaciones reales encontradas durante la implementación. -->

- Rate limits y reintentos con backoff hacia LLM y búsqueda; colas con concurrencia controlada.
- Scraping profundo: proxies, rotación, respeto de `robots.txt`, render de JS.
- Enriquecimiento con fuentes adicionales (Google Places, LinkedIn, SUNAT/RUC).
- Cumplimiento de Ley 29733 (datos personales), base legal y retención de datos.
- Deduplicación avanzada (fuzzy matching por nombre/dirección).
- Evaluación del agente (set de casos dorados, métricas de precisión y alucinación).
- Observabilidad del LLM (trazas de tokens, costo y latencia por job).
- Optimización de cold start de NestJS en Lambda (bundle con esbuild, provisioned concurrency si aplica).
- Frontend para el equipo comercial (listado, filtros por score, exportación).
- IaC (AWS CDK / SAM), CI/CD y entornos.
