import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG } from '../providers/tokens.js';
import { type ConfigOptions, loadAppConfig } from './app-config.js';

@Module({})
export class ConfigModule {
  static forRoot(options: ConfigOptions): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig(process.env, options) }],
      exports: [APP_CONFIG],
    };
  }
}
