import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { ExternalIdentity } from './entities/external-identity.entity';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { SessionFamily } from './entities/session-family.entity';
import { ATHLETE_SELF_REGISTRATION_ENABLED } from '@treino-multi/shared';
import { GoogleIdTokenProvider } from './oauth-providers/google-id-token';
import { OAuthIdentityProvider } from './interfaces/oauth-identity-provider.interface';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { PasswordChangeLog } from '../audit-logs/entities/password-change-log.entity';
import { AuthQueryProvider } from './auth-query.provider';

const ACCESS_TTL_SECONDS = 15 * 60;
const REMEMBER_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const MEMORY_FAMILY_MS = 8 * 60 * 60 * 1000;
const hash = (value: string) =>
	crypto.createHash('sha256').update(value).digest('hex');
export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	rememberMe: boolean;
}

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(ExternalIdentity)
		private readonly identityRepo: Repository<ExternalIdentity>,
		private readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly googleProvider: GoogleIdTokenProvider,
		private readonly auditLogService: AuditLogService,
		private readonly usersService: UsersService,
		private readonly authQueries: AuthQueryProvider,
	) {}

	async validateUser(login: string, password: string): Promise<User | null> {
		const normalized = login.trim().toLowerCase();
		const users = await this.authQueries.execute({
			script: 'loginUsers',
			email: normalized,
		});
		const standalone = users.filter((user) => user.context === 'standalone');
		const selected =
			standalone.length === 1
				? standalone[0]
				: users.length === 1
					? users[0]
					: null;
		if (
			!selected?.passwordHash ||
			!(await bcrypt.compare(password, selected.passwordHash))
		)
			return null;
		return selected;
	}

	private payload(user: User): JwtPayload {
		return {
			sub: user.id,
			personId: user.personId,
			name: user.person?.name,
			context: user.context,
			tenantId: user.tenantId,
			roles: (user.userRoles ?? []).filter((r) => !r.deletedAt).map((r) => r.role),
			impersonatedBy: null,
		};
	}

	private access(
		user: User,
		absoluteExpiresAt: Date | null,
		impersonatedBy: string | null = null,
	): string {
		const remaining = absoluteExpiresAt
			? Math.floor((absoluteExpiresAt.getTime() - Date.now()) / 1000)
			: ACCESS_TTL_SECONDS;
		if (remaining <= 0) throw new UnauthorizedException('Sessão expirada');
		return this.jwtService.sign(
			{ ...this.payload(user), impersonatedBy },
			{ expiresIn: Math.min(ACCESS_TTL_SECONDS, remaining) },
		);
	}

	private async createSession(
		user: User,
		rememberMe: boolean,
		ipAddress?: string,
		userAgent?: string,
	): Promise<AuthTokens> {
		const familyHash = hash(crypto.randomBytes(32).toString('base64url'));
		const now = new Date();
		const absoluteExpiresAt = rememberMe
			? null
			: new Date(now.getTime() + MEMORY_FAMILY_MS);
		const refreshToken = crypto.randomBytes(64).toString('base64url');
		const accessToken = this.access(user, absoluteExpiresAt);
		await this.dataSource.transaction(async (manager) => {
			await manager.save(
				SessionFamily,
				manager.create(SessionFamily, {
					userId: user.id,
					familyHash,
					rememberMe,
					absoluteExpiresAt,
				}),
			);
			await manager.save(
				RefreshToken,
				manager.create(RefreshToken, {
					userId: user.id,
					familyHash,
					tokenHash: hash(refreshToken),
					consumedAt: null,
					expiresAt: rememberMe
						? new Date(now.getTime() + REMEMBER_REFRESH_MS)
						: absoluteExpiresAt!,
					ipAddress: ipAddress ?? null,
					userAgent: userAgent ?? null,
				}),
			);
			await manager.update(User, user.id, { lastLoginAt: now });
		});
		return { accessToken, refreshToken, rememberMe };
	}

	async login(
		dto: LoginDto,
		ipAddress?: string,
		userAgent?: string,
	): Promise<AuthTokens> {
		const user = await this.validateUser(dto.login, dto.password);
		await this.auditLogService.logAuthentication({
			tenantId: user?.tenantId ?? null,
			context: user?.context ?? 'standalone',
			success: !!user,
			loginUsed: hash(dto.login.trim().toLowerCase()),
			ipAddress: ipAddress ?? null,
		});
		if (!user) throw new UnauthorizedException('Credenciais inválidas');
		return this.createSession(
			user,
			dto.rememberMe === true,
			ipAddress,
			userAgent,
		);
	}

	async registerAthlete(
		input: { name: string; email: string; password: string; phone?: string },
		ipAddress?: string,
	) {
		if (!ATHLETE_SELF_REGISTRATION_ENABLED)
			throw new ForbiddenException('Autocadastro indisponível.');
		const user = await this.usersService.createManagedUser(
			{
				name: input.name,
				email: input.email,
				password: input.password,
				phone: input.phone,
				context: 'standalone',
				tenantId: null,
				tenantFunction: 'client',
			},
			null,
			ipAddress ?? '',
		);
		return { id: user.id };
	}

	private providerIdentity(provider: OAuthProvider): OAuthIdentityProvider {
		if (provider === this.googleProvider.provider) return this.googleProvider;
		throw new UnauthorizedException('Provider indisponível.');
	}

	async loginOAuth(
		provider: OAuthProvider,
		credential: string,
		rememberMe: boolean,
		ipAddress?: string,
		userAgent?: string,
	): Promise<AuthTokens> {
		let loginUsed = hash(`${provider}:${credential}`);
		let user: User | null = null;
		let success = false;
		try {
			const identity = await this.providerIdentity(provider).verify(credential);
			const email = identity.email.trim().toLowerCase();
			loginUsed = hash(email);
			const lookup = await this.authQueries.execute({
				script: 'oauthAccount',
				provider,
				subject: identity.sub,
				email,
			});
			if (lookup.linkedUserId) {
				if (!lookup.userId || lookup.accountEmail?.trim().toLowerCase() !== email)
					throw new UnauthorizedException('Email do provider diverge da conta.');
				user = Object.assign(new User(), {
					id: lookup.userId,
					personId: lookup.personId,
					tenantId: lookup.tenantId,
					context: lookup.context,
					person: { name: lookup.name, email },
					userRoles: lookup.roles.map((role) => ({ role, deletedAt: null })),
				});
			} else {
				if (lookup.emailExists)
					throw new ConflictException(
						'Entre na conta existente e vincule o provider em Métodos de login.',
					);
				if (!ATHLETE_SELF_REGISTRATION_ENABLED)
					throw new ForbiddenException('Autocadastro indisponível.');
				user = await this.dataSource.transaction(async (manager) => {
					const person = await manager.save(
						Person,
						manager.create(Person, {
							name: identity.name || email.split('@')[0],
							email,
							phone: null,
							document: null,
						}),
					);
					const created = await manager.save(
						User,
						manager.create(User, {
							personId: person.id,
							tenantId: null,
							context: 'standalone',
							passwordHash: null,
							isActive: true,
						}),
					);
					const role = await manager.save(
						UserRole,
						manager.create(UserRole, {
							userId: created.id,
							role: Role.TENANT_CLIENT,
						}),
					);
					await manager.save(
						ExternalIdentity,
						manager.create(ExternalIdentity, {
							userId: created.id,
							provider,
							subject: identity.sub,
						}),
					);
					await manager.save(
						CriticalOperationLog,
						manager.create(CriticalOperationLog, {
							tenantId: null,
							tableName: 'users',
							operation: 'CREATE',
							recordId: created.id,
							userId: null,
							ipAddress: ipAddress ?? null,
							diff: null,
						}),
					);
					created.person = person;
					created.userRoles = [role];
					return created;
				});
			}
			const tokens = await this.createSession(
				user,
				rememberMe,
				ipAddress,
				userAgent,
			);
			success = true;
			return tokens;
		} finally {
			await this.auditLogService.logAuthentication({
				tenantId: user?.tenantId ?? null,
				context: user?.context ?? 'standalone',
				success,
				loginUsed,
				ipAddress: ipAddress ?? null,
			});
		}
	}

	async loginMethods(userId: string) {
		const methods = await this.authQueries.execute({
			script: 'loginMethods',
			userId,
		});
		if (!methods) throw new UnauthorizedException('Conta inativa.');
		return methods;
	}

	async linkProvider(
		actor: JwtPayload,
		provider: OAuthProvider,
		credential: string,
	) {
		const identity = await this.providerIdentity(provider).verify(credential);
		const user = await this.userRepo.findOne({
			where: { id: actor.sub, isActive: true },
			relations: ['person'],
		});
		if (
			!user ||
			user.person.email?.trim().toLowerCase() !==
				identity.email.trim().toLowerCase()
		)
			throw new ForbiddenException('Email do provider não corresponde à conta.');
		const existing = await this.identityRepo.findOne({
			where: { provider, subject: identity.sub },
		});
		if (existing?.userId === user.id) return this.loginMethods(user.id);
		if (existing)
			throw new ConflictException(
				'Identidade externa já vinculada a outra conta.',
			);
		if (await this.identityRepo.exists({ where: { userId: user.id, provider } }))
			throw new ConflictException(
				'Já existe uma identidade deste provider na conta.',
			);
		await this.identityRepo.save(
			this.identityRepo.create({
				userId: user.id,
				provider,
				subject: identity.sub,
			}),
		);
		return this.loginMethods(user.id);
	}

	async unlinkProvider(
		actor: JwtPayload,
		provider: OAuthProvider,
		password?: string,
		credential?: string,
	) {
		// Só a conta sem senha usa a reautenticação pelo provider.
		const account = await this.userRepo.findOne({
			where: { id: actor.sub, isActive: true },
			relations: ['person'],
		});
		if (!account) throw new UnauthorizedException('Conta inativa.');
		let subject: string | undefined;
		if (!account.passwordHash) {
			if (!credential) throw new UnauthorizedException('Reautenticação necessária.');
			const identity = await this.providerIdentity(provider).verify(credential);
			if (Date.now() / 1000 - identity.iat > 5 * 60)
				throw new UnauthorizedException('Reautenticação recente necessária.');
			if (account.person.email?.trim().toLowerCase() !== identity.email.trim().toLowerCase())
				throw new ForbiddenException('Email do provider não corresponde à conta.');
			subject = identity.sub;
		}
		return this.dataSource.transaction(async (manager) => {
			const user = await manager.findOneOrFail(User, {
				where: { id: actor.sub, isActive: true },
				lock: { mode: 'pessimistic_write' },
			});
			if (user.passwordHash) {
				if (!password || !(await bcrypt.compare(password, user.passwordHash)))
					throw new UnauthorizedException('Senha atual inválida.');
			} else if (!subject) {
				throw new UnauthorizedException('Reautenticação necessária.');
			}
			const linked = await manager.findOne(ExternalIdentity, {
				where: { userId: actor.sub, provider, ...(user.passwordHash ? {} : { subject }) },
			});
			if (!linked) throw new ForbiddenException('Provider não vinculado à conta.');
			if (
				!user.passwordHash &&
				(await manager.count(ExternalIdentity, { where: { userId: actor.sub } })) <= 1
			)
				throw new ConflictException('A conta deve manter ao menos um método de login.');
			await manager.delete(ExternalIdentity, linked.id);
			return { provider, linked: false };
		});
	}

	async setFirstPassword(
		actor: JwtPayload,
		provider: OAuthProvider,
		credential: string,
		newPassword: string,
		revokeAllSessions: boolean,
		ipAddress?: string,
	) {
		const identity = await this.providerIdentity(provider).verify(credential);
		if (Date.now() / 1000 - identity.iat > 5 * 60)
			throw new UnauthorizedException('Reautenticação recente necessária.');
		const account = await this.userRepo.findOne({
			where: { id: actor.sub, isActive: true },
			relations: ['person'],
		});
		if (
			!account ||
			account.person.email?.trim().toLowerCase() !==
				identity.email.trim().toLowerCase()
		)
			throw new ForbiddenException('Email do provider não corresponde à conta.');
		const linked = await this.identityRepo.findOne({
			where: { userId: actor.sub, provider, subject: identity.sub },
		});
		if (!linked) throw new ForbiddenException('Identidade não vinculada.');
		const passwordHash = await bcrypt.hash(newPassword, 12);
		await this.dataSource.transaction(async (manager) => {
			const user = await manager.findOneOrFail(User, {
				where: { id: actor.sub, isActive: true },
				lock: { mode: 'pessimistic_write' },
			});
			if (user.passwordHash)
				throw new ConflictException('A conta já possui senha.');
			await manager.update(User, user.id, { passwordHash });
			if (revokeAllSessions)
				await this.authQueries.execute({
					script: 'revokeFamilies',
					userId: user.id,
					manager,
				});
			await manager.save(
				PasswordChangeLog,
				manager.create(PasswordChangeLog, {
					userId: user.id,
					tenantId: user.tenantId,
					isSession: true,
					ipAddress: ipAddress ?? null,
				}),
			);
		});
	}

	async refreshAccessToken(rawToken: string): Promise<AuthTokens> {
		const tokenHash = hash(rawToken);
		const result = await this.dataSource.transaction(async (manager) => {
			const stored = await manager.findOne(RefreshToken, {
				where: { tokenHash },
				lock: { mode: 'pessimistic_write' },
			});
			if (!stored?.familyHash) return { error: 'Refresh token inválido' } as const;
			const family = await manager.findOne(SessionFamily, {
				where: { familyHash: stored.familyHash },
				lock: { mode: 'pessimistic_write' },
			});
			if (!family || family.revokedAt)
				return { error: 'Sessão revogada' } as const;
			if (stored.consumedAt) {
				await this.authQueries.execute({
					script: 'revokeReusedSession',
					familyId: family.id,
					familyHash: family.familyHash,
					manager,
				});
				return {
					error: 'Reuso de refresh token detectado; sessão revogada',
				} as const;
			}
			const now = new Date();
			if (
				stored.revokedAt ||
				stored.expiresAt <= now ||
				(family.absoluteExpiresAt && family.absoluteExpiresAt <= now)
			)
				return { error: 'Refresh token expirado' } as const;
			const user = await manager.findOne(User, {
				where: { id: family.userId, isActive: true },
				relations: ['userRoles', 'person'],
			});
			if (!user) return { error: 'Usuário inativo' } as const;
			const next = crypto.randomBytes(64).toString('base64url');
			await manager.update(RefreshToken, stored.id, { consumedAt: now });
			await manager.save(
				RefreshToken,
				manager.create(RefreshToken, {
					userId: user.id,
					familyHash: family.familyHash,
					tokenHash: hash(next),
					consumedAt: null,
					expiresAt: family.rememberMe
						? new Date(now.getTime() + REMEMBER_REFRESH_MS)
						: family.absoluteExpiresAt!,
					ipAddress: stored.ipAddress,
					userAgent: stored.userAgent,
				}),
			);
			return {
				accessToken: this.access(user, family.absoluteExpiresAt),
				refreshToken: next,
				rememberMe: family.rememberMe,
			};
		});
		if ('error' in result) throw new UnauthorizedException(result.error);
		return result;
	}

	async logout(rawToken: string): Promise<void> {
		const found = await this.authQueries.execute({
			script: 'logout',
			tokenHash: hash(rawToken),
		});
		if (!found) throw new NotFoundException('Sessão não encontrada');
	}

	async impersonate(
		actor: JwtPayload,
		tenantId: string,
		targetUserId?: string,
	): Promise<{ accessToken: string }> {
		const target = targetUserId
			? await this.userRepo.findOne({
					where: { id: targetUserId, tenantId, isActive: true },
					relations: ['userRoles', 'person'],
				})
			: await this.authQueries.execute({ script: 'tenantAdmin', tenantId });
		if (!target) throw new NotFoundException('Usuário alvo não encontrado');
		const remaining = actor.exp
			? actor.exp - Math.floor(Date.now() / 1000)
			: ACCESS_TTL_SECONDS;
		if (remaining <= 0) throw new UnauthorizedException('Token expirado');
		return {
			accessToken: this.jwtService.sign(
				{ ...this.payload(target), impersonatedBy: actor.sub },
				{ expiresIn: Math.min(ACCESS_TTL_SECONDS, remaining) },
			),
		};
	}

	async resetPassword(
		token: string,
		newPassword: string,
		ipAddress?: string | null,
	): Promise<void> {
		return this.usersService.resetPassword(token, newPassword, ipAddress ?? null);
	}
}
