# Reto Técnico: Agente IA para Extracción y Cualificación de Leads

> Enunciado original del reto (Líder Técnico — fintech). **No editar**: es la fuente de verdad de los requerimientos. Las interpretaciones de ambigüedades están en la sección 2 del `README.md`.

## Contexto del Negocio

El equipo comercial necesita automatizar la prospección de clientes (B2B o B2C). Tu misión es diseñar y construir una prueba de concepto (PoC) de un Agente IA capaz de buscar, extraer y estructurar información de leads potenciales desde fuentes públicas en internet según un sector empresarial configurable, para finalmente almacenarlos en una base de datos.

## Requerimientos Funcionales

- **Configuración Dinámica:** El agente debe recibir como parámetros de entrada (ej. a través de un endpoint o un script CLI) el **sector empresarial** (ej. "Agencias de marketing", "Clínicas dentales") y la **ubicación** (ej. "Lima, Perú").
- **Capacidad de Búsqueda (Tools/Skills):** El agente debe utilizar una herramienta para buscar información en internet. *Nota de alcance:* Dado el límite de tiempo de 1 día, no es necesario construir un scraper complejo desde cero. Puedes usar APIs de búsqueda (ej. SerpApi, Tavily, Google Places API) o, en su defecto, crear un "mock tool" que simule devolver resultados crudos de una búsqueda para que el Agente los procese.
- **Extracción y Cualificación (LLM):** El agente debe procesar el texto/resultados obtenidos y estructurar los siguientes datos del lead usando un LLM: Nombre de la Empresa/Persona, Sector, Resumen de lo que hacen, y Posibles datos de contacto (si se encuentran).
- **Almacenamiento:** Los datos extraídos y estructurados deben guardarse automáticamente en una base de datos.

## Stack Tecnológico Sugerido

- **Lenguaje:** Node.js (TypeScript) o Python (a elección del candidato, acorde al perfil evaluado).
- **Framework de IA:** LangChain, LlamaIndex, AWS Bedrock Agents, o llamadas directas al SDK del LLM (OpenAI, Anthropic, Bedrock).
- **Modelos (LLM):** Amazon Bedrock (Claude), OpenAI (GPT-4o-mini), o modelos Open Source vía API local/groq.
- **Despliegue / Cloud (Simulado):** Preferiblemente orientado a arquitectura Serverless (AWS Lambda, API Gateway). Puede ser ejecutado localmente mediante Serverless Framework, AWS SAM, o un framework ligero (FastAPI/Express).
- **Base de Datos:** DynamoDB (puedes usar dynalite/DynamoDB Local), MongoDB, PostgreSQL, o SQLite por simplicidad para la prueba local.

## Entregables

- **Código Fuente (Repositorio Público en GitHub/GitLab):**
  - Código limpio, modular y aplicando buenas prácticas de desarrollo.
  - Uso de variables de entorno (.env) para las claves de API (no subir claves al repositorio).
- **Diagrama de Arquitectura (Bosquejo):**
  - Un diagrama simple (puede ser en Draw.io, Excalidraw, Miro o similar) que ilustre cómo se desplegaría esta solución en producción sobre AWS (ej. API Gateway -> Lambda -> Bedrock -> DynamoDB). No es necesario implementarlo en la nube real, solo diagramarlo.
- **Archivo README.md:**
  - **Instrucciones de instalación y ejecución:** Cómo levantar el proyecto paso a paso en una máquina local.
  - **Decisiones técnicas:** Breve explicación de por qué elegiste el framework de IA, la base de datos y el modelo.
  - **Limitaciones y mejoras futuras:** Qué le faltaría al proyecto para estar 100% listo para producción (ej. manejo de rate limits, proxies para scraping, etc.).

## Criterios de Evaluación

- **Diseño Agéntico:** Correcta implementación de "Tool Calling" o flujos de razonamiento (ReAct) donde el LLM decide cuándo buscar y cuándo guardar.
- **Prompt Engineering:** Calidad de las instrucciones dadas al LLM para extraer y formatear los datos de manera estructurada (JSON) minimizando alucinaciones.
- **Arquitectura de Software:** Separación de responsabilidades (ej. capa de controladores, capa del agente, capa de base de datos).
- **Visión Cloud:** Calidad y coherencia del diagrama de arquitectura propuesto para un entorno AWS de alta escalabilidad.
