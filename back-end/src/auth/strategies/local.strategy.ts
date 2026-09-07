import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

/**
 * Estratégia Local — valida login (e-mail ou document) + password enviados no body do POST /auth/login.
 * O campo 'login' é mapeado como usernameField do passport-local.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly authService: AuthService,
		private readonly auditLogService: AuditLogService,
	) {
		super({ usernameField: 'login', passReqToCallback: true });
	}

	/**
	 * Chamado pelo LocalAuthGuard antes de chegar ao endpoint.
	 * Lança UnauthorizedException se as credenciais forem inválidas ou o usuário inativo.
	 */
	async validate(request: Request, login: string, password: string) {
		const normalizedLogin = normalizeLogin(login);
		const user = await this.authService.validateUser(normalizedLogin, password);
		if (!user) {
			// Falhas são interrompidas pelo Passport antes de AuthService.login().
			// Registre-as aqui para manter a trilha de auditoria completa.
			await this.auditLogService.logAuthentication({
				tenantId: null,
				context: 'standalone',
				success: false,
				loginUsed: normalizedLogin,
				ipAddress: request.ip ?? null,
			});
			throw new UnauthorizedException('Credenciais inválidas');
		}
		return user;
	}
}

function normalizeLogin(login: string): string {
	const trimmedLogin = login.trim();
	return trimmedLogin.includes('@')
		? trimmedLogin.toLocaleLowerCase('en-US')
		: trimmedLogin;
}
