import { Module } from '@nestjs/common';
import { coreProviders } from '../providers/core.providers.js';
import { infrastructureProviders } from '../providers/infrastructure.providers.js';
import { LeadsController } from './leads.controller.js';
import { SEARCH_LEADS_USE_CASE } from '../providers/tokens.js';

@Module({
  controllers: [LeadsController],
  providers: [...infrastructureProviders, ...coreProviders],
  exports: [SEARCH_LEADS_USE_CASE],
})
export class LeadsModule {}
