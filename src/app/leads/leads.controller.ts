import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { ListLeadsUseCase } from '../../core/application/list-leads.use-case.js';
import type { SearchLeadsUseCase } from '../../core/application/search-leads.use-case.js';
import type { SubmitSearchJobUseCase } from '../../core/application/submit-search-job.use-case.js';
import type { Lead } from '../../core/domain/lead.js';
import type { AgentRunSummary } from '../../core/domain/run-summary.js';
import { type SearchCriteria, SearchCriteriaSchema } from '../../core/domain/search-criteria.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  LIST_LEADS_USE_CASE,
  SEARCH_LEADS_USE_CASE,
  SUBMIT_SEARCH_JOB_USE_CASE,
} from '../providers/tokens.js';
import { JobAcceptedDto } from './dto/job-accepted.dto.js';
import { LeadDto } from './dto/lead.dto.js';
import { RunSummaryDto } from './dto/run-summary.dto.js';
import { SearchLeadsRequestDto } from './dto/search-leads-request.dto.js';

/** Capa de controladores: solo traduce HTTP ⇄ casos de uso del núcleo. */
@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(LIST_LEADS_USE_CASE) private readonly listLeads: ListLeadsUseCase,
    @Inject(SUBMIT_SEARCH_JOB_USE_CASE) private readonly submitJob: SubmitSearchJobUseCase,
    // Solo existe si este proceso ejecuta el agente (EXECUTION_MODE=sync); ver AppModule.
    @Optional()
    @Inject(SEARCH_LEADS_USE_CASE)
    private readonly searchLeads?: SearchLeadsUseCase,
  ) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecuta el agente: busca, cualifica y guarda leads',
    description:
      'EXECUTION_MODE=sync (local): responde 200 con el resumen cuando el agente termina. EXECUTION_MODE=async (AWS): responde 202 con el jobId; el resultado se consulta en GET /jobs/{jobId}.',
  })
  @ApiBody({ type: SearchLeadsRequestDto })
  @ApiOkResponse({ type: RunSummaryDto, description: 'Modo sync' })
  @ApiAcceptedResponse({ type: JobAcceptedDto, description: 'Modo async' })
  async search(
    @Body(new ZodValidationPipe(SearchCriteriaSchema)) criteria: SearchCriteria,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AgentRunSummary | JobAcceptedDto> {
    if (this.searchLeads) return this.searchLeads.execute(criteria);

    const job = await this.submitJob.execute(criteria);
    response.status(HttpStatus.ACCEPTED);
    return { jobId: job.jobId, status: job.status, statusUrl: `/jobs/${job.jobId}` };
  }

  @Get()
  @ApiOperation({ summary: 'Lista los leads guardados, ordenados por qualificationScore' })
  @ApiOkResponse({ type: [LeadDto] })
  list(): Promise<Lead[]> {
    return this.listLeads.execute();
  }
}
