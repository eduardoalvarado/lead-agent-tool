// Tokens de inyección del composition root. Las clases del núcleo no conocen Nest:
// se registran con `useFactory` y se inyectan por estos símbolos.
export const APP_CONFIG = Symbol('APP_CONFIG');
export const LOGGER = Symbol('LOGGER');
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');
export const PAGE_FETCHER = Symbol('PAGE_FETCHER');
export const LEAD_REPOSITORY = Symbol('LEAD_REPOSITORY');
export const LEAD_AGENT = Symbol('LEAD_AGENT');
export const SEARCH_LEADS_USE_CASE = Symbol('SEARCH_LEADS_USE_CASE');
export const LIST_LEADS_USE_CASE = Symbol('LIST_LEADS_USE_CASE');
