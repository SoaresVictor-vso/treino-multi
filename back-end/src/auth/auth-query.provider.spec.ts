import { AuthQueryProvider } from './auth-query.provider';
import { LOGIN_METHODS_SQL, LOGOUT_SQL, OAUTH_ACCOUNT_SQL } from './auth.sql';

describe('AuthQueryProvider', () => {
	it('revokes a session with one parameterized database action', async () => {
		const query = jest.fn().mockResolvedValue([{ found: true }]);
		const provider = new AuthQueryProvider({ query } as any);
		await expect(
			provider.execute({ script: 'logout', tokenHash: 'hash' }),
		).resolves.toBe(true);
		expect(query).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledWith(LOGOUT_SQL, ['hash', expect.any(Date)]);
	});

	it('returns missing sessions without another database action', async () => {
		const query = jest.fn().mockResolvedValue([{ found: false }]);
		const provider = new AuthQueryProvider({ query } as any);
		await expect(
			provider.execute({ script: 'logout', tokenHash: 'missing' }),
		).resolves.toBe(false);
		expect(query).toHaveBeenCalledTimes(1);
	});

	it('uses exported SQL for OAuth lookup and login methods', async () => {
		const lookup = {
			linkedUserId: null,
			userId: null,
			personId: null,
			tenantId: null,
			context: null,
			name: null,
			accountEmail: null,
			roles: [],
			emailExists: false,
		};
		const methods = { passwordAvailable: true, providers: [] };
		const query = jest
			.fn()
			.mockResolvedValueOnce([lookup])
			.mockResolvedValueOnce([methods]);
		const provider = new AuthQueryProvider({ query } as any);
		await expect(
			provider.execute({
				script: 'oauthAccount',
				provider: 'google' as any,
				subject: 'sub',
				email: 'email@test.local',
			}),
		).resolves.toBe(lookup);
		await expect(
			provider.execute({ script: 'loginMethods', userId: 'user-id' }),
		).resolves.toBe(methods);
		expect(query).toHaveBeenNthCalledWith(1, OAUTH_ACCOUNT_SQL, [
			'google',
			'sub',
			'email@test.local',
		]);
		expect(query).toHaveBeenNthCalledWith(2, LOGIN_METHODS_SQL, ['user-id']);
	});
});
