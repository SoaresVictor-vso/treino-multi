import { enums } from '@treino-multi/shared';
const { Role } = enums;
type Role = enums.Role;
import { DataSource } from 'typeorm';

import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { User } from '../users/entities/user.entity';
import { AthleteTenantAssociation } from './entities/athlete-tenant-association.entity';
import { AthleteTenantAssociationsService } from './athlete-tenant-associations.service';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describe('AthleteTenantAssociationsService tenant history', () => {
  it('masks identity after 30 days and never returns episode or athlete identifiers', async () => {
    const actor = { sub: 'operator', tenantId: 'tenant', roles: [Role.TENANT_ADMIN] } as any;
    const episode = (id: string, age: number) => ({ id, athleteId: `athlete-${id}`,
      tenantId: 'tenant', status: 'cancelled', scope: 'ALL_WORKOUTS',
      invitedAt: daysAgo(age + 20), startedAt: daysAgo(age + 19), endedAt: daysAgo(age),
      athlete: { person: { name: `Name ${id}`, email: `${id}@private.test` } } });
    const episodes = [episode('recent', 29), episode('old', 31)];
    const logs = episodes.map(item => ({ recordId: item.id, operation: 'UPDATE',
      diff: { status: { after: 'cancelled' } }, userId: item.athleteId, createdAt: item.endedAt }));
    const db = { getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return { findOne: jest.fn().mockResolvedValue({ id: actor.sub, tenantId: actor.tenantId,
        isActive: true, userRoles: [{ role: Role.TENANT_ADMIN, deletedAt: null }] }) };
      if (entity === AthleteTenantAssociation) return { find: jest.fn().mockResolvedValue(episodes) };
      if (entity === CriticalOperationLog) return { find: jest.fn().mockResolvedValue(logs) };
      throw new Error('unexpected repository');
    }) } as unknown as DataSource;
    const result = await new AthleteTenantAssociationsService(db).tenantHistory(actor);
    expect(result[0].athleteName).toBe('Name recent');
    expect(result[1].athleteName).toBe('Atleta desligado');
    expect(result[1].events).toEqual([{ type: 'cancelled', at: episodes[1].endedAt, actorRole: 'atleta' }]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/athlete-recent|athlete-old|@private\.test|"id"|"recordId"/);
    expect(serialized).not.toContain('Name old');
  });
});

describe('AthleteTenantAssociationsService invited email history', () => {
  it('returns the submitted email only for invitation history, without revealing cancelled identities', async () => {
    const actor = { sub: 'operator', tenantId: 'tenant', roles: [Role.TENANT_ADMIN] } as any;
    const episodes = (['pending', 'rejected', 'expired', 'active', 'cancelled'] as const).map(status => ({
      id: status, athleteId: `athlete-${status}`, tenantId: 'tenant', status,
      scope: 'PRESCRIBED_BY_TENANT', invitedEmail: `${status}@invited.test`,
      invitedAt: daysAgo(40), startedAt: status === 'active' || status === 'cancelled' ? daysAgo(39) : null,
      endedAt: status === 'cancelled' ? daysAgo(31) : null,
      athlete: { person: { name: `Name ${status}`, email: `${status}@current.test` } },
    }));
    const db = { getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return { findOne: jest.fn().mockResolvedValue({ id: actor.sub, tenantId: actor.tenantId,
        isActive: true, userRoles: [{ role: Role.TENANT_ADMIN, deletedAt: null }] }) };
      if (entity === AthleteTenantAssociation) return { find: jest.fn().mockResolvedValue(episodes) };
      if (entity === CriticalOperationLog) return { find: jest.fn().mockResolvedValue([]) };
      throw new Error('unexpected repository');
    }) } as unknown as DataSource;
    const result = await new AthleteTenantAssociationsService(db).tenantHistory(actor);
    expect(result.map(item => item.invitedEmail)).toEqual([
      'pending@invited.test', 'rejected@invited.test', 'expired@invited.test', null, null,
    ]);
    expect(result[4].athleteName).toBe('Atleta desligado');
    expect(JSON.stringify(result)).not.toMatch(/@current\.test|cancelled@invited\.test/);
  });
});
