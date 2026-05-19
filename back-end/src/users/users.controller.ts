import {
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as jwtPayloadInterface from '../auth/interfaces/jwt-payload.interface';

/**
 * CRUD de User (vínculo Person ↔ contexto).
 * Todas as rotas exigem JWT ativo (JwtAuthGuard global).
 */
@ApiTags('users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** POST /users — cria um novo vínculo de usuário */
  @ApiOperation({ summary: 'Cria um novo usuário (vínculo Person ⇔ contexto)' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @Post()
  @RequirePermissions(Permission.USER_CREATE)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
    @Ip() ip: string,
  ) {
    return this.usersService.create(dto, actor.sub, ip);
  }

  /** GET /users — lista todos os usuários */
  @ApiOperation({ summary: 'Lista todos os usuários (soft-deleted excluídos)' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  @Get()
  @RequirePermissions(Permission.USER_READ)
  findAll() {
    return this.usersService.findAll();
  }

  /** GET /users/:id — detalhe de um usuário */
  @ApiOperation({ summary: 'Busca usuário por ID' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Get(':id')
  @RequirePermissions(Permission.USER_READ)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOne(id);
  }

  /** PATCH /users/:id — atualiza senha, isActive ou roles */
  @ApiOperation({ summary: 'Atualiza senha, status ou roles do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado' })
  @Patch(':id')
  @RequirePermissions(Permission.USER_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @Ip() ip: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    return this.usersService.update(id, dto, actor.sub, ip);
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
    return this.usersService.remove(id, actor.sub, ip);
  }

  /**
   * POST /users/:id/password-reset-link
   *
   * Gera um token de redefinição de senha com TTL de 30 minutos.
   * - org:admin pode gerar para qualquer usuário
   * - tenant:admin só pode gerar para usuários do seu próprio tenant
   */
  @ApiOperation({ summary: 'Gera link/token de redefinição de senha (TTL 30 min)' })
  @ApiResponse({ status: 201, description: 'Token gerado com sucesso' })
  @ApiResponse({ status: 403, description: 'Acesso negado (tenant diferente)' })
  @Post(':id/password-reset-link')
  @RequirePermissions(Permission.USER_PASSWORD_RESET)
  generatePasswordResetLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: jwtPayloadInterface.JwtPayload,
  ) {
    console.log(actor, id)
    // tenant:admin passa o próprio tenantId; org:admin tem tenantId=null
    return this.usersService.generatePasswordResetToken(id, actor.tenantId);
  }
}

