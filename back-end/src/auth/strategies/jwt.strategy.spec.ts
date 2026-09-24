import { JwtStrategy } from './jwt.strategy';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const payload: JwtPayload = { sub: 'user-id', personId: 'person-id', context: 'standalone',
  tenantId: null, roles: [Role.TENANT_CLIENT], impersonatedBy: null };

describe('JwtStrategy', () => {
  it('returns the payload after passport-jwt validates signature and expiration', () => {
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as any);
    expect(strategy.validate(payload)).toEqual(payload);
  });
});
