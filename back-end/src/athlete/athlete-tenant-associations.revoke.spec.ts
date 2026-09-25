import { enums } from '@treino-multi/shared';
const { Role } = enums;
type Role = enums.Role;
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';

import { User } from '../users/entities/user.entity';
import { AthleteTenantAssociationsService } from './athlete-tenant-associations.service';
import { AthleteTenantAssociation } from './entities/athlete-tenant-association.entity';

describe('AthleteTenantAssociationsService revoke', () => {
  const actor = { sub: 'sender', tenantId: 'tenant', roles: [Role.TENANT_ADMIN] } as any;
  const setup = (overrides: Record<string, unknown> = {}) => {
    const episode = { id: 'invite', tenantId: 'tenant', invitedByUserId: 'sender', status: 'pending',
      expiresAt: new Date(Date.now() + 60_000), ...overrides };
    const save = jest.fn(async value => value);
    const manager = { findOne: jest.fn().mockResolvedValue(episode), save,
      create: jest.fn((_entity, value) => value) };
    const db = { getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return { findOne: jest.fn().mockResolvedValue({ id: actor.sub, tenantId: actor.tenantId,
        isActive: true, userRoles: [{ role: Role.TENANT_ADMIN, deletedAt: null }] }) };
      throw new Error('unexpected repository');
    }), transaction: jest.fn(async callback => callback(manager)) } as unknown as DataSource;
    return { service: new AthleteTenantAssociationsService(db), episode, manager, save };
  };

  it('revokes the sender’s pending invitation and records the change', async () => {
    const { service, episode, manager, save } = setup();
    await expect(service.revoke(actor, 'invite', '127.0.0.1')).resolves.toEqual({ id: 'invite', status: 'revoked' });
    expect(episode.status).toBe('revoked');
    expect(manager.findOne).toHaveBeenCalledWith(AthleteTenantAssociation,
      { where: { id: 'invite' }, lock: { mode: 'pessimistic_write' } });
    expect(save).toHaveBeenCalledWith(CriticalOperationLog, expect.objectContaining({
      userId: 'sender', diff: { status: { before: 'pending', after: 'revoked' } },
    }));
  });

  it('rejects another operator and invitations already accepted or expired', async () => {
    await expect(setup({ invitedByUserId: 'other' }).service.revoke(actor, 'invite')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ status: 'active' }).service.revoke(actor, 'invite')).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ expiresAt: new Date(Date.now() - 1) }).service.revoke(actor, 'invite')).rejects.toBeInstanceOf(ConflictException);
  });
});
