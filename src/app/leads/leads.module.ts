import { Module } from '@nestjs/common';
import { JobsController } from '../jobs/jobs.controller.js';
import { coreProviders } from '../providers/core.providers.js';
import { infrastructureProviders } from '../providers/infrastructure.providers.js';
import { PROCESS_SEARCH_JOB_USE_CASE, SEARCH_LEADS_USE_CASE } from '../providers/tokens.js';
import { LeadsController } from './leads.controller.js';

@Module({
  controllers: [LeadsController, JobsController],
  providers: [...infrastructureProviders, ...coreProviders],
  exports: [SEARCH_LEADS_USE_CASE, PROCESS_SEARCH_JOB_USE_CASE],
})
export class LeadsModule {}
