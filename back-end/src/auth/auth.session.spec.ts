import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthQueryProvider } from './auth-query.provider';
import { REVOKE_REUSED_SESSION_SQL } from './auth.sql';
import { SessionFamily } from './entities/session-family.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

const hash = (value: string) =>
	crypto.createHash('sha256').update(value).digest('hex');

describe('rotating session family', () => {
	it('consumes each refresh once, keeps the family hash and revokes the family on reuse', async () => {
		const raw = 'random-family.random-refresh';
		const deadline = new Date(Date.now() + 8 * 60 * 60_000);
		const family = {
			id: 'family-id',
			userId: 'user-id',
			familyHash: hash('random-family'),
			rememberMe: false,
			absoluteExpiresAt: deadline,
			revokedAt: null as Date | null,
		};
		const stored = [
			{
				id: 'refresh-id',
				userId: 'user-id',
				familyHash: family.familyHash,
				tokenHash: hash(raw),
				consumedAt: null as Date | null,
				revokedAt: null as Date | null,
				expiresAt: deadline,
				ipAddress: null,
				userAgent: null,
			},
		];
		const user = {
			id: 'user-id',
			personId: 'person-id',
			context: 'standalone',
			tenantId: null,
			isActive: true,
			person: { name: 'Athlete' },
			userRoles: [],
		};
		const manager = {
			findOne: jest.fn(async (entity: unknown, options: any) => {
				if (entity === RefreshToken)
					return (
						stored.find((token) => token.tokenHash === options.where.tokenHash) ??
						null
					);
				if (entity === SessionFamily) return family;
				if (entity === User) return user;
				return null;
			}),
			update: jest.fn(
				async (entity: unknown, id: string, changes: Record<string, unknown>) => {
					Object.assign(
						entity === RefreshToken
							? stored.find((token) => token.id === id)!
							: family,
						changes,
					);
				},
			),
			create: jest.fn((_entity: unknown, value: unknown) => value),
			save: jest.fn(async (_entity: unknown, value: any) => {
				stored.push({ ...value, id: `refresh-${stored.length}` });
			}),
			createQueryBuilder: jest.fn(() => ({
				update: () => ({
					set: () => ({ where: () => ({ execute: async () => ({}) }) }),
				}),
			})),
			query: jest.fn(async (_sql: string, args: [string, string, Date]) => {
				family.revokedAt = args[2];
				stored.forEach((token) => {
					if (token.familyHash === args[1]) token.revokedAt = args[2];
				});
				return [{ revoked: true }];
			}),
		};
		const db = {
			transaction: async (action: (manager: typeof manager) => Promise<unknown>) =>
				action(manager),
		};
		const jwt = { sign: jest.fn().mockReturnValue('new-access-token') };
		const service = new AuthService(
			{} as any,
			{} as any,
			db as any,
			jwt as any,
			{} as any,
			{} as any,
			{} as any,
			new AuthQueryProvider(db as any),
		);

		const first = await service.refreshAccessToken(raw);
		expect(first.accessToken).toBe('new-access-token');
		expect(first.refreshToken).not.toBe(raw);
		expect(first.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(stored[0].consumedAt).toBeInstanceOf(Date);
		expect(stored[1].familyHash).toBe(family.familyHash);
		expect(stored[1].expiresAt).toEqual(deadline);
		expect(stored[1].tokenHash).toBe(hash(first.refreshToken));
		expect(JSON.stringify(stored)).not.toContain(first.refreshToken);
		expect(jwt.sign).toHaveBeenCalledWith(
			expect.objectContaining({ sub: 'user-id' }),
			expect.objectContaining({ expiresIn: expect.any(Number) }),
		);

		await expect(service.refreshAccessToken(raw)).rejects.toBeInstanceOf(
			UnauthorizedException,
		);
		expect(family.revokedAt).toBeInstanceOf(Date);
		expect(manager.query).toHaveBeenCalledTimes(1);
		expect(manager.query).toHaveBeenCalledWith(REVOKE_REUSED_SESSION_SQL, [
			family.id,
			family.familyHash,
			expect.any(Date),
		]);
		await expect(
			service.refreshAccessToken(first.refreshToken),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
