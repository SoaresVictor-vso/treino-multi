import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthService } from './auth.service';
import { SessionFamily } from './entities/session-family.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('AuthService password login and sessions', () => {
  let service: AuthService;
  let personRepo: { findOne: jest.Mock };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let refreshRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let familyRepo: { update: jest.Mock; findOne: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock; update: jest.Mock; query: jest.Mock };
  let jwt: { sign: jest.Mock };
  let audit: { logAuthentication: jest.Mock };
  const person = { id: 'person-id', name: 'Athlete', email: 'athlete@example.test' };
  let athlete: any;
  let tenantUser: any;

  beforeEach(async () => {
    athlete = { id: 'athlete-id', personId: person.id, tenantId: null, context: 'standalone',
      passwordHash: await bcrypt.hash('correct-password', 4), isActive: true, person,
      userRoles: [{ role: Role.TENANT_CLIENT, deletedAt: null }] };
    tenantUser = { ...athlete, id: 'trainer-id', context: 'tenant', tenantId: 'tenant-id',
      tenant: { slug: 'studio' }, userRoles: [{ role: Role.TENANT_TRAINER, deletedAt: null }] };
    personRepo = { findOne: jest.fn().mockResolvedValue(person) };
    userRepo = { find: jest.fn().mockResolvedValue([athlete, tenantUser]), findOne: jest.fn() };
    refreshRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(() =>
      ({ update: () => ({ set: () => ({ where: () => ({ execute: async () => ({}) }) }) }) })) };
    familyRepo = { update: jest.fn(), findOne: jest.fn() };
    manager = { create: jest.fn((_entity, value) => value), save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined), query: jest.fn().mockResolvedValue([]) };
    jwt = { sign: jest.fn().mockReturnValue('signed-access') };
    audit = { logAuthentication: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(personRepo as any, userRepo as any, {} as any, refreshRepo as any,
      familyRepo as any, {} as any, { transaction: (action: any) => action(manager) } as any,
      jwt as any, {} as any, audit as any, {} as any);
  });

  it('normalizes email and selects the standalone athlete by default', async () => {
    expect(await service.validateUser(' ATHLETE@EXAMPLE.TEST ', 'correct-password')).toBe(athlete);
    expect(personRepo.findOne).toHaveBeenCalledWith({ where: { email: person.email } });
  });

  it('uses the standalone account when a person has multiple accounts, or the sole account', async () => {
    expect(await service.validateUser(person.email, 'correct-password')).toBe(athlete);
    userRepo.find.mockResolvedValue([tenantUser]);
    expect(await service.validateUser(person.email, 'correct-password')).toBe(tenantUser);
    expect(await service.validateUser(person.email, 'wrong-password')).toBeNull();
  });

  it('does not allow password login for an OAuth-only account', async () => {
    userRepo.find.mockResolvedValue([{ ...athlete, passwordHash: null }]);
    expect(await service.validateUser(person.email, 'correct-password')).toBeNull();
  });

  it('stores only refresh and family hashes and limits an unremembered login to eight hours', async () => {
    const result = await service.login({ login: person.email, password: 'correct-password', rememberMe: false });
    expect(result.accessToken).toBe('signed-access');
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
    const family = manager.save.mock.calls.find(([entity]) => entity === SessionFamily)![1];
    const refresh = manager.save.mock.calls.find(([entity]) => entity === RefreshToken)![1];
    expect(family.rememberMe).toBe(false);
    expect(family.familyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(refresh.familyHash).toBe(family.familyHash);
    expect(refresh.tokenHash).toBe(hash(result.refreshToken));
    expect(refresh.expiresAt).toEqual(family.absoluteExpiresAt);
    expect(family.absoluteExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(8 * 60 * 60_000);
    expect(jwt.sign).toHaveBeenCalledWith(expect.not.objectContaining({ sid: expect.anything(), jti: expect.anything(), familyHash: expect.anything() }),
      expect.objectContaining({ expiresIn: expect.any(Number) }));
    const accessPayload = jwt.sign.mock.calls[0][0];
    expect(accessPayload).not.toHaveProperty('sid');
    expect(accessPayload).not.toHaveProperty('jti');
    expect(accessPayload).not.toHaveProperty('familyHash');
    expect(JSON.stringify([family, refresh])).not.toContain(result.refreshToken);
  });

  it('gives remembered refreshes a rolling 30 day deadline without a family deadline', async () => {
    await service.login({ login: person.email, password: 'correct-password', rememberMe: true });
    const family = manager.save.mock.calls.find(([entity]) => entity === SessionFamily)![1];
    const refresh = manager.save.mock.calls.find(([entity]) => entity === RefreshToken)![1];
    expect(family.absoluteExpiresAt).toBeNull();
    expect(refresh.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 86_400_000);
    expect(refresh.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
  });

  it('rejects unknown logins and revokes the entire family on logout', async () => {
    personRepo.findOne.mockResolvedValue(null);
    await expect(service.login({ login: 'missing@test.local', password: 'correct-password' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    refreshRepo.findOne.mockResolvedValue({ familyHash: 'stored-family-hash' });
    await service.logout('raw-refresh');
    expect(familyRepo.update).toHaveBeenCalledWith({ familyHash: 'stored-family-hash' },
      { revokedAt: expect.any(Date) });
    refreshRepo.findOne.mockResolvedValue(null);
    await expect(service.logout('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AuthService OAuth login audit and lookup', () => {
  const identity = { sub: 'google-subject', email: ' ATHLETE@EXAMPLE.TEST ', name: 'Athlete', iat: 1 };
  const provider = { provider: 'google', verify: jest.fn().mockResolvedValue(identity) };
  const person = { id: 'person-id', name: 'Athlete', email: 'athlete@example.test' };
  const audit = { logAuthentication: jest.fn().mockResolvedValue(undefined) };
  const manager = { create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined) };
  const db = { query: jest.fn(), transaction: async (action: any) => action(manager) };
  const service = new AuthService({} as any, {} as any, {} as any, {} as any,
    {} as any, {} as any, db as any, { sign: () => 'access' } as any,
    provider as any, audit as any, {} as any);

  beforeEach(() => { jest.clearAllMocks(); provider.verify.mockResolvedValue(identity); });

  it('loads the linked account and its roles in one query, then logs success', async () => {
    db.query.mockResolvedValue([{ linkedUserId: 'user-id', userId: 'user-id', personId: person.id,
      tenantId: null, context: 'standalone', name: person.name, accountEmail: person.email,
      roles: [Role.TENANT_CLIENT], emailExists: true }]);
    const result = await service.loginOAuth('google' as any, 'credential', false, '127.0.0.1');
    expect(result.accessToken).toBe('access');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(audit.logAuthentication).toHaveBeenCalledWith({ tenantId: null, context: 'standalone',
      success: true, loginUsed: hash(person.email), ipAddress: '127.0.0.1' });
  });

  it('logs a verified identity that cannot be linked as a failed login', async () => {
    db.query.mockResolvedValue([{ linkedUserId: null, userId: null, personId: null,
      tenantId: null, context: null, name: null, accountEmail: null, roles: [], emailExists: true }]);
    await expect(service.loginOAuth('google' as any, 'credential', false, '127.0.0.1'))
      .rejects.toThrow('Entre na conta existente');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(audit.logAuthentication).toHaveBeenCalledWith({ tenantId: null, context: 'standalone',
      success: false, loginUsed: hash(person.email), ipAddress: '127.0.0.1' });
  });
});
