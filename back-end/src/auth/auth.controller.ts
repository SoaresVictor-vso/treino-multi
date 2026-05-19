import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as jwtPayloadInterface from './interfaces/jwt-payload.interface';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Role } from '../common/enums/role.enum';
import { Permission } from '../common/enums/permission.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Rota pública — não exige JWT.
   * Retorna accessToken (15 min) + refreshToken (7 dias).
   */
  @ApiOperation({ summary: 'Login com e-mail/document e senha' })
  @ApiResponse({ status: 200, description: 'Retorna accessToken e refreshToken' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: express.Request,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ip, userAgent);
  }

  /**
   * POST /auth/refresh
   * Rota pública — recebe o refreshToken no body e retorna novo accessToken.
   */
  @ApiOperation({ summary: 'Emite novo accessToken a partir do refreshToken' })
  @ApiResponse({ status: 200, description: 'Novo accessToken emitido' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Rota protegida — revoga o refreshToken informado no body.
   */
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revoga o refreshToken (logout)' })
  @ApiResponse({ status: 204, description: 'Token revogado com sucesso' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  /**
   * POST /auth/impersonate
   * Exclusivo para usuários com role org:support (única role com USER_IMPERSONATE).
   *
   * Dupla proteção:
   *   - @Roles garante que somente org:support acessa o endpoint.
   *   - @RequirePermissions garante que a permissão USER_IMPERSONATE está ativa,
   *     protegendo contra futuras mudanças no mapa de permissões.
   *
   * Retorna um accessToken com contexto do tenant-alvo e impersonatedBy preenchido.
   */
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Impersonation: org:support acessa como usuário de tenant' })
  @ApiResponse({ status: 200, description: 'Token de impersonation gerado' })
  @ApiResponse({ status: 403, description: 'Permissão negada (requer org:support)' })
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(Role.ORG_SUPPORT)
  @RequirePermissions(Permission.USER_IMPERSONATE)
  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @CurrentUser() user: jwtPayloadInterface.JwtPayload,
    @Body() dto: ImpersonateDto,
  ) {
    return this.authService.impersonate(user.sub, dto.tenantId, dto.targetUserId);
  }

  /**
   * POST /auth/reset-password
   * Rota pública — valida o token de reset e altera a senha.
   */
  @ApiOperation({ summary: 'Redefine a senha usando token de redefinição (30 min TTL)' })
  @ApiResponse({ status: 204, description: 'Senha redefinida com sucesso' })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ip: string,
  ) {
    await this.authService.resetPassword(dto.token, dto.newPassword, ip);
  }
}
