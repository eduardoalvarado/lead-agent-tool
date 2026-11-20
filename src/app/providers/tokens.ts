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
export const DYNAMO_CLIENT = Symbol('DYNAMO_CLIENT');
export const CLOCK = Symbol('CLOCK');
export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');
export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const SUBMIT_SEARCH_JOB_USE_CASE = Symbol('SUBMIT_SEARCH_JOB_USE_CASE');
export const PROCESS_SEARCH_JOB_USE_CASE = Symbol('PROCESS_SEARCH_JOB_USE_CASE');
export const GET_JOB_USE_CASE = Symbol('GET_JOB_USE_CASE');
