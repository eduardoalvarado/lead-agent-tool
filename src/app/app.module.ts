import { type DynamicModule, Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module.js';
import { ConfigModule } from './config/config.module.js';
import type { ConfigOptions } from './config/app-config.js';
import { InfrastructureModule } from './infrastructure.module.js';
import { LeadsModule } from './leads/leads.module.js';

/**
 * Composición por proceso: el agente (LLM, búsqueda y sus credenciales) solo se construye en los
 * procesos que lo ejecutan: worker, CLI y API en modo sync. La λ api en modo async no lo carga.
 */
@Module({})
export class AppModule {
  static forRoot(options: ConfigOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options),
        InfrastructureModule,
        LeadsModule,
        ...(options.runsAgent ? [AgentModule] : []),
      ],
    };
  }
}
