import { Module } from '@nestjs/common';
import { JobsController } from '../jobs/jobs.controller.js';
import { coreProviders } from '../providers/core.providers.js';
import { LeadsController } from './leads.controller.js';

@Module({
  controllers: [LeadsController, JobsController],
  providers: coreProviders,
})
export class LeadsModule {}
