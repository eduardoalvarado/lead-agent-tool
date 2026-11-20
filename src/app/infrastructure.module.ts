import { Global, Module } from '@nestjs/common';
import { infrastructureProviders } from './providers/infrastructure.providers.js';
import { CLOCK, JOB_QUEUE, JOB_REPOSITORY, LEAD_REPOSITORY, LOGGER } from './providers/tokens.js';

/** Adaptadores comunes a todos los procesos: persistencia, cola, log y reloj. */
@Global()
@Module({
  providers: infrastructureProviders,
  exports: [LOGGER, LEAD_REPOSITORY, JOB_REPOSITORY, JOB_QUEUE, CLOCK],
})
export class InfrastructureModule {}
