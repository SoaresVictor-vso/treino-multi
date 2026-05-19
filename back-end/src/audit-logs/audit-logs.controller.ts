import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogService, AuditLogFilter } from './audit-logs.service';
import { AuthenticationLog } from './entities/authentication-log.entity';
import { CriticalOperationLog } from './entities/critical-operation-log.entity';
import { PasswordChangeLog } from './entities/password-change-log.entity';

/** Parâmetros de query compartilhados por todos os endpoints de log */
class LogQueryDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

@ApiTags('audit-logs')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.LOG_READ)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /** GET /audit-logs/authentication */
  @ApiOperation({ summary: 'Lista logs de autenticação (login/logout)' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 date' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs de autenticação' })
  @Get('authentication')
  async getAuthenticationLogs(
    @Query() q: LogQueryDto,
  ): Promise<{ data: AuthenticationLog[]; total: number; page: number; limit: number }> {
    const filter = this.parseFilter(q);
    const result = await this.auditLogService.findAuthenticationLogs(filter);
    return { ...result, page: filter.page!, limit: filter.limit! };
  }

  /** GET /audit-logs/critical-operations */
  @ApiOperation({ summary: 'Lista logs de operações críticas' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs críticos' })
  @Get('critical-operations')
  async getCriticalOperationLogs(
    @Query() q: LogQueryDto,
  ): Promise<{ data: CriticalOperationLog[]; total: number; page: number; limit: number }> {
    const filter = this.parseFilter(q);
    const result = await this.auditLogService.findCriticalOperationLogs(filter);
    return { ...result, page: filter.page!, limit: filter.limit! };
  }

  /** GET /audit-logs/password-changes */
  @ApiOperation({ summary: 'Lista logs de troca de senha' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs de senha' })
  @Get('password-changes')
  async getPasswordChangeLogs(
    @Query() q: LogQueryDto,
  ): Promise<{ data: PasswordChangeLog[]; total: number; page: number; limit: number }> {
    const filter = this.parseFilter(q);
    const result = await this.auditLogService.findPasswordChangeLogs(filter);
    return { ...result, page: filter.page!, limit: filter.limit! };
  }

  private parseFilter(q: LogQueryDto): Required<Pick<AuditLogFilter, 'page' | 'limit'>> & AuditLogFilter {
    return {
      tenantId: q.tenantId,
      userId: q.userId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page: q.page ? Math.max(1, parseInt(q.page, 10)) : 1,
      limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10))) : 20,
    };
  }
}
