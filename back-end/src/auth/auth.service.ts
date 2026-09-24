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
import { ATHLETE_SELF_REGISTRATION_ENABLED } from '../../../packages/shared/constants';
import { GoogleIdTokenProvider } from './oauth-providers/google-id-token';
import { OAuthIdentityProvider } from './interfaces/oauth-identity-provider.interface';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { PasswordChangeLog } from '../audit-logs/entities/password-change-log.entity';

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
		@InjectRepository(Person) private readonly personRepo: Repository<Person>,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(UserRole)
		private readonly userRoleRepo: Repository<UserRole>,
		@InjectRepository(RefreshToken)
		private readonly refreshTokenRepo: Repository<RefreshToken>,
		@InjectRepository(SessionFamily)
		private readonly familyRepo: Repository<SessionFamily>,
		@InjectRepository(ExternalIdentity)
		private readonly identityRepo: Repository<ExternalIdentity>,
		private readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly googleProvider: GoogleIdTokenProvider,
		private readonly auditLogService: AuditLogService,
		private readonly usersService: UsersService,
	) {}

	async validateUser(login: string, password: string): Promise<User | null> {
		const normalized = login.trim().toLowerCase();
		let person = await this.personRepo.findOne({ where: { email: normalized } });

		if (!person) return null;
		const users = await this.userRepo.find({
			where: { personId: person.id, isActive: true },
			relations: ['userRoles', 'person'],
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
			// Resolve identity, account and email collision in one round trip.
			const [lookup] = await this.dataSource.query<
				{
					linkedUserId: string | null;
					userId: string | null;
					personId: string | null;
					tenantId: string | null;
					context: User['context'] | null;
					name: string | null;
					accountEmail: string | null;
					roles: Role[];
					emailExists: boolean;
				}[]
			>(
				`
        WITH linked AS (
          SELECT ei.user_id FROM external_identities ei
          WHERE ei.provider = $1::oauth_provider_enum AND ei.subject = $2
        )
        SELECT linked.user_id AS "linkedUserId", u.id AS "userId",
          u.person_id AS "personId", u.tenant_id AS "tenantId", u.context,
          p.name, p.email AS "accountEmail",
          COALESCE((SELECT jsonb_agg(ur.role) FROM user_roles ur
            WHERE ur.user_id = u.id AND ur.deleted_at IS NULL), '[]'::jsonb) AS roles,
          EXISTS(SELECT 1 FROM persons owner WHERE owner.email = $3) AS "emailExists"
        FROM (SELECT 1) anchor LEFT JOIN linked ON true
        LEFT JOIN users u ON u.id = linked.user_id AND u.is_active = true AND u.deleted_at IS NULL
        LEFT JOIN persons p ON p.id = u.person_id`,
				[provider, identity.sub, email],
			);
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
		const user = await this.userRepo.findOne({
			where: { id: userId, isActive: true },
		});
		if (!user) throw new UnauthorizedException('Conta inativa.');
		const identities = await this.identityRepo.find({ where: { userId } });
		return {
			passwordAvailable: !!user.passwordHash,
			providers: identities.map((i) => i.provider),
		};
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
		credential: string,
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
		return this.dataSource.transaction(async (manager) => {
			const user = await manager.findOneOrFail(User, {
				where: { id: actor.sub, isActive: true },
			});
			const linked = await manager.findOne(ExternalIdentity, {
				where: { userId: actor.sub, provider, subject: identity.sub },
			});
			if (!linked) throw new ForbiddenException('Provider não vinculado à conta.');
			if (
				!user.passwordHash &&
				(await manager.count(ExternalIdentity, { where: { userId: actor.sub } })) <=
					1
			)
				throw new ConflictException(
					'A conta deve manter ao menos um método de login.',
				);
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
				await manager
					.createQueryBuilder()
					.update(SessionFamily)
					.set({ revokedAt: new Date() })
					.where('user_id = :userId AND revoked_at IS NULL', { userId: user.id })
					.execute();
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
				await manager.update(SessionFamily, family.id, { revokedAt: new Date() });
				await manager
					.createQueryBuilder()
					.update(RefreshToken)
					.set({ revokedAt: new Date() })
					.where('family_hash = :familyHash AND revoked_at IS NULL', {
						familyHash: family.familyHash,
					})
					.execute();
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
		const stored = await this.refreshTokenRepo.findOne({
			where: { tokenHash: hash(rawToken) },
		});
		if (!stored?.familyHash) throw new NotFoundException('Sessão não encontrada');
		await this.familyRepo.update(
			{ familyHash: stored.familyHash },
			{ revokedAt: new Date() },
		);
		await this.refreshTokenRepo
			.createQueryBuilder()
			.update()
			.set({ revokedAt: new Date() })
			.where('family_hash = :familyHash AND revoked_at IS NULL', {
				familyHash: stored.familyHash,
			})
			.execute();
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
			: await this.userRepo
					.createQueryBuilder('u')
					.innerJoinAndSelect('u.userRoles', 'ur')
					.leftJoinAndSelect('u.person', 'person')
					.where('u.tenant_id = :tenantId AND u.is_active = true', { tenantId })
					.andWhere('ur.role = :role AND ur.deleted_at IS NULL', {
						role: Role.TENANT_ADMIN,
					})
					.getOne();
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
