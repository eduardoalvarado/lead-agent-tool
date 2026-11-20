import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListLeadsUseCase } from '../../core/application/list-leads.use-case.js';
import type { SearchLeadsUseCase } from '../../core/application/search-leads.use-case.js';
import type { Lead } from '../../core/domain/lead.js';
import type { AgentRunSummary } from '../../core/domain/run-summary.js';
import { type SearchCriteria, SearchCriteriaSchema } from '../../core/domain/search-criteria.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LIST_LEADS_USE_CASE, SEARCH_LEADS_USE_CASE } from '../providers/tokens.js';
import { LeadDto } from './dto/lead.dto.js';
import { RunSummaryDto } from './dto/run-summary.dto.js';
import { SearchLeadsRequestDto } from './dto/search-leads-request.dto.js';

/** Capa de controladores: solo traduce HTTP ⇄ casos de uso del núcleo. */
@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(SEARCH_LEADS_USE_CASE) private readonly searchLeads: SearchLeadsUseCase,
    @Inject(LIST_LEADS_USE_CASE) private readonly listLeads: ListLeadsUseCase,
  ) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecuta el agente: busca, cualifica y guarda leads',
    description:
      'Síncrono en la PoC: responde cuando el agente termina (puede tardar minutos). En producción el flujo es asíncrono (202 + jobId).',
  })
  @ApiBody({ type: SearchLeadsRequestDto })
  @ApiOkResponse({ type: RunSummaryDto })
  search(
    @Body(new ZodValidationPipe(SearchCriteriaSchema)) criteria: SearchCriteria,
  ): Promise<AgentRunSummary> {
    return this.searchLeads.execute(criteria);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los leads guardados, ordenados por qualificationScore' })
  @ApiOkResponse({ type: [LeadDto] })
  list(): Promise<Lead[]> {
    return this.listLeads.execute();
  }
}
