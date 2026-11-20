import { Controller, Get, Inject, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { GetJobUseCase } from '../../core/application/get-job.use-case.js';
import type { Job } from '../../core/domain/job.js';
import { GET_JOB_USE_CASE } from '../providers/tokens.js';
import { JobDto } from './job.dto.js';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(@Inject(GET_JOB_USE_CASE) private readonly getJob: GetJobUseCase) {}

  @Get(':jobId')
  @ApiOperation({
    summary: 'Estado y resultado de una búsqueda asíncrona',
    description:
      'pending → running → completed | failed. Al completarse incluye el resumen con los leads.',
  })
  @ApiOkResponse({ type: JobDto })
  @ApiNotFoundResponse({ description: 'El job no existe' })
  find(@Param('jobId') jobId: string): Promise<Job> {
    return this.getJob.execute(jobId);
  }
}
