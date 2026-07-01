import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as jwtPayloadInterface from '../auth/interfaces/jwt-payload.interface';
import { CreateTenantFullDto } from './dto/create-tenant-full.dto';

/**
 * CRUD de Tenant.
 * Todas as rotas exigem JWT ativo (JwtAuthGuard global).
 */
@ApiTags('tenants')
@ApiBearerAuth('JWT')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** POST /tenants — cria um novo tenant */
  @ApiOperation({ summary: 'Cria um novo tenant' })
  @ApiResponse({ status: 201, description: 'Tenant criado com sucesso' })
  @Post()
  @RequirePermissions(Permission.TENANT_CREATE)
  create(
    @Body() dto: CreateTenantFullDto,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
    @Ip() ip: string,
  ) {
    return this.tenantsService.create(dto, actor.sub, ip);
  }

  /** GET /tenants — lista tenants (ativos por padrão) */
  @ApiOperation({ summary: 'Lista tenants (ativos por padrão)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de tenants' })
  @Get()
  @RequirePermissions(Permission.TENANT_READ)
  findAll(
    @Query('includeInactive') includeInactive?: string,
    @Query('name') name?: string,
    @Query('filter') filter?: string,
  ) {
    if (!['all', 'name'].includes(filter || ''))
      throw new BadRequestException("Filtro inválido. Use 'all' ou 'name'.");
    return this.tenantsService.findAll(
      includeInactive === 'true',
      name,
      filter,
    );
  }

  /** GET /tenants/:id — detalhe de um tenant */
  @ApiOperation({ summary: 'Busca tenant por ID' })
  @ApiResponse({ status: 200, description: 'Tenant encontrado' })
  @ApiResponse({ status: 404, description: 'Tenant não encontrado' })
  @Get(':id')
  @RequirePermissions(Permission.TENANT_READ)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantsService.findOne(id);
  }

  @ApiOperation({ summary: 'Busca tenant por ID com dados do administrador' })
  @ApiResponse({ status: 200, description: 'Detalhe do tenant encontrado' })
  @ApiResponse({ status: 404, description: 'Tenant não encontrado' })
  @Get(':id/details')
  @RequirePermissions(Permission.TENANT_READ)
  findDetails(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantsService.findDetails(id);
  }

  /** PATCH /tenants/:id — atualiza dados de um tenant */
  @ApiOperation({ summary: 'Atualiza dados do tenant' })
  @ApiResponse({ status: 200, description: 'Tenant atualizado' })
  @Patch(':id')
  @RequirePermissions(Permission.TENANT_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  /** DELETE /tenants/:id — exclusão lógica (soft delete) */
  @ApiOperation({ summary: 'Remove tenant (soft delete)' })
  @ApiResponse({ status: 204, description: 'Removido com sucesso' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.TENANT_DELETE)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantsService.remove(id);
  }
}
