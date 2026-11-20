import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { LeadsModule } from './leads/leads.module.js';

@Module({ imports: [ConfigModule, LeadsModule] })
export class AppModule {}
