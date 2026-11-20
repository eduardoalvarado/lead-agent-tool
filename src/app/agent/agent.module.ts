import { Global, Module } from '@nestjs/common';
import { agentProviders } from '../providers/agent.providers.js';
import { PROCESS_SEARCH_JOB_USE_CASE, SEARCH_LEADS_USE_CASE } from '../providers/tokens.js';

/** El agente y los casos de uso que lo ejecutan; solo en los procesos que lo necesitan. */
@Global()
@Module({
  providers: agentProviders,
  exports: [SEARCH_LEADS_USE_CASE, PROCESS_SEARCH_JOB_USE_CASE],
})
export class AgentModule {}
