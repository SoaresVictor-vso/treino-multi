import { enums } from '@treino-multi/shared';
const { Role } = enums;
type Role = enums.Role;
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';


const response = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });
const request = (cookie?: string) => ({ headers: { 'user-agent': 'test-agent', origin: 'https://app.test', ...(cookie ? { cookie } : {}) } });

describe('AuthController session transport', () => {
  const previousFrontendUrl = process.env.FRONT_END_URL;
  const auth = { login: jest.fn(), loginOAuth: jest.fn(), refreshAccessToken: jest.fn(),
    logout: jest.fn(), impersonate: jest.fn() };
  const controller = new AuthController(auth as unknown as AuthService);
  beforeAll(() => { process.env.FRONT_END_URL = 'https://app.test'; });
  afterAll(() => {
    if (previousFrontendUrl === undefined) delete process.env.FRONT_END_URL;
    else process.env.FRONT_END_URL = previousFrontendUrl;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns the refresh only for a window-memory login', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'private-refresh', rememberMe: false };
    auth.login.mockResolvedValue(tokens);
    const res = response();
    expect(await controller.login({ login: 'a@test.com', password: 'password', rememberMe: false },
      '127.0.0.1', request() as any, res as any)).toEqual(tokens);
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('sends a remembered refresh only as an HttpOnly cookie', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'private-refresh', rememberMe: true };
    auth.login.mockResolvedValue(tokens);
    const res = response();
    expect(await controller.login({ login: 'a@test.com', password: 'password', rememberMe: true },
      '127.0.0.1', request() as any, res as any)).toEqual({ ...tokens, refreshToken: '' });
    expect(res.cookie).toHaveBeenCalledWith('rememberRefreshToken', 'private-refresh',
		expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' }));
  });

  it('rotates from the remembered cookie without exposing the new refresh', async () => {
    auth.refreshAccessToken.mockResolvedValue({ accessToken: 'next-access', refreshToken: 'next-refresh', rememberMe: true });
    const res = response();
    expect(await controller.refresh({}, request('rememberRefreshToken=old-refresh') as any, res as any))
      .toEqual({ accessToken: 'next-access', refreshToken: '', rememberMe: true });
    expect(auth.refreshAccessToken).toHaveBeenCalledWith('old-refresh');
    expect(res.cookie).toHaveBeenCalledWith('rememberRefreshToken', 'next-refresh', expect.any(Object));
  });

  it('clears a remembered browser and propagates invalid refresh errors', async () => {
    auth.logout.mockResolvedValue(undefined);
    const res = response();
    await controller.forgetBrowser(request('rememberRefreshToken=old-refresh') as any, res as any);
    expect(auth.logout).toHaveBeenCalledWith('old-refresh');
    expect(res.clearCookie).toHaveBeenCalled();
    auth.refreshAccessToken.mockRejectedValue(new UnauthorizedException());
    await expect(controller.refresh({ refreshToken: 'invalid' }, request() as any, response() as any))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('passes the authenticated support actor to impersonation', async () => {
    const actor = { sub: 'support', roles: [Role.ORG_SUPPORT] } as any;
    auth.impersonate.mockResolvedValue({ accessToken: 'support-token' });
    expect(await controller.impersonate(actor, { tenantId: 'tenant' }))
      .toEqual({ accessToken: 'support-token' });
    expect(auth.impersonate).toHaveBeenCalledWith(actor, 'tenant', undefined);
  });
});
