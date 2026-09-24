import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Ip,
	Post,
	Req,
	Res,
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
import {
	IsBoolean,
	IsEmail,
	IsEnum,
	IsOptional,
	IsString,
	MinLength,
} from 'class-validator';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { assertTrustedOrigin } from '../common/security/trusted-origin';

class AthleteSignupDto {
	@IsString() @MinLength(2) name!: string;
	@IsEmail() email!: string;
	@IsString() @MinLength(8) password!: string;
	@IsOptional() @IsString() phone?: string;
}
class OAuthDto {
	@IsEnum(OAuthProvider) provider!: OAuthProvider;
	@IsString() credential!: string;
	@IsOptional() @IsBoolean() rememberMe?: boolean;
}
class UnlinkProviderDto {
	@IsEnum(OAuthProvider) provider!: OAuthProvider;
	@IsOptional() @IsString() password?: string;
	@IsOptional() @IsString() credential?: string;
}
class SetFirstPasswordDto extends OAuthDto {
	@IsString() @MinLength(8) newPassword!: string;
	@IsOptional() @IsBoolean() revokeAllSessions?: boolean;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post('forget-browser')
	@HttpCode(HttpStatus.NO_CONTENT)
	async forgetBrowser(
		@Req() req: express.Request,
		@Res({ passthrough: true }) res: express.Response,
	) {
		assertTrustedOrigin(req);
		const token = this.readRefreshCookie(req);
		if (token) await this.authService.logout(token).catch(() => undefined);
		this.setRefreshCookie(res, null);
	}

	@Public()
	@Post('athlete-signup')
	registerAthlete(@Body() dto: AthleteSignupDto, @Ip() ip: string) {
		return this.authService.registerAthlete(dto, ip);
	}

	@Public()
	@Post('oauth/login')
	async oauthLogin(
		@Body() dto: OAuthDto,
		@Ip() ip: string,
		@Req() req: express.Request,
		@Res({ passthrough: true }) res: express.Response,
	) {
		assertTrustedOrigin(req);
		const tokens = await this.authService.loginOAuth(
			dto.provider,
			dto.credential,
			dto.rememberMe === true,
			ip,
			req.headers['user-agent'],
		);
		this.setRefreshCookie(res, tokens.rememberMe ? tokens.refreshToken : null);
		return this.publicTokens(tokens);
	}

	@ApiBearerAuth('JWT')
	@Get('methods')
	methods(@CurrentUser() actor: jwtPayloadInterface.JwtPayload) {
		return this.authService.loginMethods(actor.sub);
	}

	@ApiBearerAuth('JWT')
	@Post('oauth/link')
	link(
		@CurrentUser() actor: jwtPayloadInterface.JwtPayload,
		@Body() dto: OAuthDto,
	) {
		return this.authService.linkProvider(actor, dto.provider, dto.credential);
	}

	@ApiBearerAuth('JWT')
	@Post('oauth/unlink')
	unlink(
		@CurrentUser() actor: jwtPayloadInterface.JwtPayload,
		@Body() dto: UnlinkProviderDto,
	) {
		return this.authService.unlinkProvider(
			actor,
			dto.provider,
			dto.password,
			dto.credential,
		);
	}

	@ApiBearerAuth('JWT')
	@Post('password/first')
	@HttpCode(HttpStatus.NO_CONTENT)
	setFirstPassword(
		@CurrentUser() actor: jwtPayloadInterface.JwtPayload,
		@Body() dto: SetFirstPasswordDto,
		@Ip() ip: string,
	) {
		return this.authService.setFirstPassword(
			actor,
			dto.provider,
			dto.credential,
			dto.newPassword,
			dto.revokeAllSessions === true,
			ip,
		);
	}

	/**
	 * POST /auth/login
	 * Rota pública — não exige JWT.
	 * Retorna accessToken e, somente no modo em memória, refreshToken.
	 */
	@ApiOperation({ summary: 'Login com e-mail/document e senha' })
	@ApiResponse({
		status: 200,
		description: 'Retorna accessToken e refreshToken',
	})
	@ApiResponse({ status: 401, description: 'Credenciais inválidas' })
	@Public()
	@UseGuards(AuthGuard('local'))
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() dto: LoginDto,
		@Ip() ip: string,
		@Req() req: express.Request,
		@Res({ passthrough: true }) res: express.Response,
	) {
		assertTrustedOrigin(req);
		const userAgent = req.headers['user-agent'];
		const tokens = await this.authService.login(dto, ip, userAgent);
		this.setRefreshCookie(res, tokens.rememberMe ? tokens.refreshToken : null);
		return this.publicTokens(tokens);
	}

	/**
	 * POST /auth/refresh
	 * Rota pública — recebe o refreshToken no body e retorna novo accessToken.
	 */
	@ApiOperation({ summary: 'Emite novo accessToken a partir do refreshToken' })
	@ApiResponse({ status: 200, description: 'Novo accessToken emitido' })
	@ApiResponse({
		status: 401,
		description: 'Refresh token inválido ou expirado',
	})
	@Public()
	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	async refresh(
		@Body() dto: RefreshTokenDto,
		@Req() req: express.Request,
		@Res({ passthrough: true }) res: express.Response,
	) {
		assertTrustedOrigin(req);
		const rawToken = dto.refreshToken ?? this.readRefreshCookie(req);
		const tokens = await this.authService.refreshAccessToken(rawToken);
		if (tokens.rememberMe) this.setRefreshCookie(res, tokens.refreshToken);
		return this.publicTokens(tokens);
	}

	/**
	 * POST /auth/logout
	 * Rota protegida — revoga o refreshToken informado no body.
	 */
	@ApiBearerAuth('JWT')
	@ApiOperation({ summary: 'Revoga o refreshToken (logout)' })
	@ApiResponse({ status: 204, description: 'Token revogado com sucesso' })
	@Public()
	@Post('logout')
	@HttpCode(HttpStatus.NO_CONTENT)
	async logout(
		@Body() dto: RefreshTokenDto,
		@Req() req: express.Request,
		@Res({ passthrough: true }) res: express.Response,
	) {
		assertTrustedOrigin(req);
		const rawToken = dto.refreshToken ?? this.readRefreshCookie(req);
		await this.authService.logout(rawToken);
		this.setRefreshCookie(res, null);
	}

	private readRefreshCookie(req: express.Request): string {
		const cookie = req.headers.cookie
			?.split(';')
			.map((item) => item.trim())
			.find((item) => item.startsWith('rememberRefreshToken='));
		return cookie
			? decodeURIComponent(cookie.slice('rememberRefreshToken='.length))
			: '';
	}

	private publicTokens(tokens: {
		accessToken: string;
		refreshToken: string;
		rememberMe: boolean;
	}) {
		return {
			...tokens,
			refreshToken: tokens.rememberMe ? '' : tokens.refreshToken,
		};
	}

	private setRefreshCookie(res: express.Response, token: string | null): void {
		const opts = {
			httpOnly: true,
			secure: true,
			sameSite: 'strict' as const,
			path: '/api/auth',
			maxAge: token ? 30 * 24 * 60 * 60 * 1000 : 0,
		};
		if (token) res.cookie('rememberRefreshToken', token, opts);
		else res.clearCookie('rememberRefreshToken', opts);
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
	@ApiOperation({
		summary: 'Impersonation: org:support acessa como usuário de tenant',
	})
	@ApiResponse({ status: 200, description: 'Token de impersonation gerado' })
	@ApiResponse({
		status: 403,
		description: 'Permissão negada (requer org:support)',
	})
	@UseGuards(RolesGuard, PermissionsGuard)
	@Roles(Role.ORG_SUPPORT)
	@RequirePermissions(Permission.USER_IMPERSONATE)
	@Post('impersonate')
	@HttpCode(HttpStatus.OK)
	async impersonate(
		@CurrentUser() user: jwtPayloadInterface.JwtPayload,
		@Body() dto: ImpersonateDto,
	) {
		return this.authService.impersonate(user, dto.tenantId, dto.targetUserId);
	}

	/**
	 * POST /auth/reset-password
	 * Rota pública — valida o token de reset e altera a senha.
	 */
	@ApiOperation({
		summary: 'Redefine a senha usando token de redefinição (30 min TTL)',
	})
	@ApiResponse({ status: 204, description: 'Senha redefinida com sucesso' })
	@ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
	@Public()
	@Post('reset-password')
	@HttpCode(HttpStatus.NO_CONTENT)
	async resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
		await this.authService.resetPassword(dto.token, dto.newPassword, ip);
	}
}
