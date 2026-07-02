import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as jwtPayloadInterface from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { FindUsersQueryDto, UserOrderBy } from './dto/find-users-query.dto';
import { Role } from '../common/enums/role.enum';

/**
 * CRUD organizacional de User (User + Person).
 * Todas as rotas exigem JWT ativo e só aceitam actors sem tenantId.
 */
@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /** POST /users — cria User + Person */
  @ApiOperation({ summary: 'Cria um novo usuário com Person associada' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @Post()
  @RequirePermissions(Permission.USER_CREATE)
  create(
    @Body() dto: CreateManagedUserDto,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
    @Ip() ip: string,
  ) {
    const tenantId = this.getTenantIdFromActor(actor);

    if (tenantId)
      dto.tenantId = tenantId;

    return this.usersService.createManagedUser(dto, actor.sub, ip);
  }

  /** GET /users — lista paginada com filtros simultâneos */
  @ApiOperation({ summary: 'Lista usuários com paginação e filtros por tenant, nome e role' })
  @ApiQuery({ name: 'tenantId', required: false, description: "Use 'null' para usuários sem tenant" })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'orderBy', required: false, enum: UserOrderBy })
  @ApiQuery({ name: 'start', required: false, description: 'Valor do campo de ordenação do último elemento da página anterior' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de usuários' })
  @Get()
  @RequirePermissions(Permission.USER_READ)
  async findAll(
    @Query() query: FindUsersQueryDto,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    const tenantId = this.getTenantIdFromActor(actor);
    if (tenantId)
      query.tenantId = tenantId;

    return this.usersService.findManagedUsers(query);
  }

  /** GET /users/:id — detalhe de um usuário */
  @ApiOperation({ summary: 'Busca usuário por ID' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Get(':id')
  @RequirePermissions(Permission.USER_READ)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    const tenantId = this.getTenantIdFromActor(actor);

    return this.usersService.findManagedUser(id, tenantId);
  }

  /** PATCH /users/:id — atualiza apenas dados editáveis da Person */
  @ApiOperation({ summary: 'Atualiza name, email, fone e document do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado' })
  @Patch(':id')
  @RequirePermissions(Permission.USER_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateManagedUserDto,
    @Ip() ip: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    const tenantId = this.getTenantIdFromActor(actor);
    return this.usersService.updateManagedUser(id, dto, actor.sub, ip, tenantId);
  }

  /** DELETE /users/:id — exclusão lógica */
  @ApiOperation({ summary: 'Remove usuário (soft delete)' })
  @ApiResponse({ status: 204, description: 'Removido com sucesso' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.USER_DELETE)
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
    @Ip() ip: string,
  ) {
    const tenantId = this.getTenantIdFromActor(actor);
    return this.usersService.remove(id, actor.sub, ip, tenantId);
  }

  /**
   * POST /users/:id/password-reset-link
   *
   * Gera um token de redefinição de senha com TTL de 30 minutos.
   */
  @ApiOperation({ summary: 'Gera link/token de redefinição de senha (TTL 30 min)' })
  @ApiResponse({ status: 201, description: 'Token gerado com sucesso' })
  @ApiResponse({ status: 403, description: 'Acesso negado (requer actor sem tenantId)' })
  @Post(':id/password-reset-link')
  @RequirePermissions(Permission.USER_PASSWORD_RESET)
  generatePasswordResetLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    this.ensureActorWithoutTenant(actor);
    return this.usersService.generatePasswordResetToken(id, actor.tenantId);
  }

  private ensureActorWithoutTenant(
    actor: jwtPayloadInterface.JwtPayload,
  ): void {
    if (actor.tenantId) {
      throw new ForbiddenException(
        'Acesso negado: esta operacao exige um usuario sem tenantId no JWT.',
      );
    }
  }

  private getTenantIdFromActor(
    actor: jwtPayloadInterface.JwtPayload,
  ): string | null {
    if (actor.tenantId) {
      return actor.tenantId;
    }
    return null;
  }
}
