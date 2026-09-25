import { enums } from '@treino-multi/shared';
import { randomUUID } from 'node:crypto';
import { BadRequestException, GoneException } from '@nestjs/common';
import { WorkoutSyncService } from './workout-sync.service';

describe('WorkoutSyncService', () => {
  const actor = { sub: '7a88360e-3b04-4025-86ec-d24ba5329001', roles: [enums.Role.TENANT_CLIENT] } as any;
  const cursor = (revision: number, userId = actor.sub) => Buffer.from(JSON.stringify({ userId, scope: 'workouts', revision })).toString('base64url');

  it('rejects an expired cursor instead of silently returning a partial history', async () => {
    const dataSource = { query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ revision: '15', min_cursor: '10' }]) };
    const service = new WorkoutSyncService(dataSource as any, {} as any);
    await expect(service.pull(actor, cursor(9))).rejects.toBeInstanceOf(GoneException);
    expect(dataSource.query).toHaveBeenCalledTimes(2);
  });

  it('does not accept another user cursor', async () => {
    const dataSource = { query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ revision: '15', min_cursor: '10' }]) };
    const service = new WorkoutSyncService(dataSource as any, {} as any);
    await expect(service.pull(actor, cursor(11, '231ca7da-22e1-4947-b1cf-e304e7d8a2d6'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires execution start and finish for every completed series', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new WorkoutSyncService(dataSource as any, {} as any);
    await expect(service.apply({ id: randomUUID(), operationId: randomUUID(),
      templateName: 'Treino', status: enums.WorkoutStatus.COMPLETED,
      performedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      executions: [{ exerciseId: 1, position: 1, status: enums.ExecutionStatus.COMPLETED }],
    } as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
