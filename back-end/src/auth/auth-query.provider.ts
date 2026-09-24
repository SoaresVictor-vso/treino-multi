import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { SessionFamily } from './entities/session-family.entity';
import {
	LOGIN_METHODS_SQL,
	LOGOUT_SQL,
	OAUTH_ACCOUNT_SQL,
	REVOKE_REUSED_SESSION_SQL,
} from './auth.sql';

export interface OAuthAccountLookup {
	linkedUserId: string | null;
	userId: string | null;
	personId: string | null;
	tenantId: string | null;
	context: User['context'] | null;
	name: string | null;
	accountEmail: string | null;
	roles: Role[];
	emailExists: boolean;
}

type AuthQuery =
	| {
			script: 'oauthAccount';
			provider: OAuthProvider;
			subject: string;
			email: string;
	  }
	| { script: 'revokeFamilies'; userId: string; manager: EntityManager }
	| {
			script: 'revokeReusedSession';
			familyId: string;
			familyHash: string;
			manager: EntityManager;
	  }
	| { script: 'tenantAdmin'; tenantId: string }
	| { script: 'logout'; tokenHash: string }
	| { script: 'loginUsers'; email: string }
	| { script: 'loginMethods'; userId: string };

@Injectable()
export class AuthQueryProvider {
	constructor(private readonly dataSource: DataSource) {}

	async execute(
		query: Extract<AuthQuery, { script: 'oauthAccount' }>,
	): Promise<OAuthAccountLookup>;
	async execute(
		query: Extract<AuthQuery, { script: 'tenantAdmin' }>,
	): Promise<User | null>;
	async execute(
		query: Extract<AuthQuery, { script: 'logout' }>,
	): Promise<boolean>;
	async execute(
		query: Extract<AuthQuery, { script: 'loginUsers' }>,
	): Promise<User[]>;
	async execute(
		query: Extract<AuthQuery, { script: 'loginMethods' }>,
	): Promise<{ passwordAvailable: boolean; providers: OAuthProvider[] } | null>;
	async execute(
		query: Exclude<
			AuthQuery,
			{
				script:
					| 'oauthAccount'
					| 'tenantAdmin'
					| 'logout'
					| 'loginUsers'
					| 'loginMethods';
			}
		>,
	): Promise<void>;
	async execute(
		query: AuthQuery,
	): Promise<
		| OAuthAccountLookup
		| User
		| User[]
		| boolean
		| { passwordAvailable: boolean; providers: OAuthProvider[] }
		| null
		| void
	> {
		switch (query.script) {
			case 'oauthAccount': {
				const [result] = await this.dataSource.query<OAuthAccountLookup[]>(
					OAUTH_ACCOUNT_SQL,
					[query.provider, query.subject, query.email],
				);
				return result;
			}
			case 'revokeFamilies':
				await query.manager
					.createQueryBuilder()
					.update(SessionFamily)
					.set({ revokedAt: new Date() })
					.where('user_id = :userId AND revoked_at IS NULL', {
						userId: query.userId,
					})
					.execute();
				return;
			case 'revokeReusedSession':
				await query.manager.query(REVOKE_REUSED_SESSION_SQL, [
					query.familyId,
					query.familyHash,
					new Date(),
				]);
				return;
			case 'logout': {
				const [result] = await this.dataSource.query<{ found: boolean }[]>(
					LOGOUT_SQL,
					[query.tokenHash, new Date()],
				);
				return result.found;
			}
			case 'loginUsers':
				return this.dataSource
					.getRepository(User)
					.createQueryBuilder('u')
					.innerJoinAndSelect('u.person', 'person')
					.leftJoinAndSelect('u.userRoles', 'ur')
					.where('person.email = :email AND u.is_active = true', {
						email: query.email,
					})
					.getMany();
			case 'loginMethods': {
				const [result] = await this.dataSource.query<
					{ passwordAvailable: boolean; providers: OAuthProvider[] }[]
				>(LOGIN_METHODS_SQL, [query.userId]);
				return result ?? null;
			}
			case 'tenantAdmin':
				return this.dataSource
					.getRepository(User)
					.createQueryBuilder('u')
					.innerJoinAndSelect('u.userRoles', 'ur')
					.leftJoinAndSelect('u.person', 'person')
					.where('u.tenant_id = :tenantId AND u.is_active = true', {
						tenantId: query.tenantId,
					})
					.andWhere('ur.role = :role AND ur.deleted_at IS NULL', {
						role: Role.TENANT_ADMIN,
					})
					.getOne();
		}
	}
}
