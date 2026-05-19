/**
 * Testes unitários do AuditLogService — Fase 5
 *
 * Estratégia: mocks manuais dos três repositórios.
 * Verificamos:
 *  - logAuthentication() cria e salva o registro correto
 *  - logCriticalOperation() cria e salva o registro correto
 *  - logPasswordChange() cria e salva o registro correto
 *  - Os três métodos de consulta aplicam filtros e paginação
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLogService } from './audit-logs.service';
import { AuthenticationLog } from './entities/authentication-log.entity';
import { CriticalOperationLog } from './entities/critical-operation-log.entity';
import { PasswordChangeLog } from './entities/password-change-log.entity';

// ── helpers de fixture ────────────────────────────────────────────────────────

const makeAuthLog = (overrides: Partial<AuthenticationLog> = {}): AuthenticationLog =>
  ({
    id: 'auth-log-uuid-1',
    tenantId: null,
    contextTypeId: 1,
    success: true,
    loginUsed: 'admin@org.com',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    tenant: null,
    contextType: { id: 1, name: 'organization' } as any,
    ...overrides,
  }) as AuthenticationLog;

const makeCriticalLog = (overrides: Partial<CriticalOperationLog> = {}): CriticalOperationLog =>
  ({
    id: 'crit-log-uuid-1',
    tenantId: null,
    tableName: 'users',
    operation: 'CREATE',
    recordId: 'user-uuid-1',
    userId: 'actor-uuid-1',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    tenant: null,
    user: null,
    ...overrides,
  }) as CriticalOperationLog;

const makePasswordLog = (overrides: Partial<PasswordChangeLog> = {}): PasswordChangeLog =>
  ({
    id: 'pw-log-uuid-1',
    tenantId: null,
    userId: 'user-uuid-1',
    isSession: true,
    ipAddress: '127.0.0.1',
    usedToken: null,
    createdAt: new Date(),
    tenant: null,
    user: null as any,
    ...overrides,
  }) as PasswordChangeLog;

/**
 * Cria um mock de SelectQueryBuilder que suporta a interface fluente
 * usada pelo AuditLogService (andWhere, orderBy, skip, take, getManyAndCount).
 */
const makeQbMock = (
  data: any[],
  total: number,
): Partial<SelectQueryBuilder<any>> => {
  const qb: Partial<SelectQueryBuilder<any>> = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total]),
  };
  return qb;
};

// ── setup do módulo de teste ──────────────────────────────────────────────────

describe('AuditLogService', () => {
  let service: AuditLogService;
  let authLogRepo: jest.Mocked<Repository<AuthenticationLog>>;
  let criticalLogRepo: jest.Mocked<Repository<CriticalOperationLog>>;
  let passwordLogRepo: jest.Mocked<Repository<PasswordChangeLog>>;

  beforeEach(async () => {
    const makeRepoMock = () => ({
      create: jest.fn((dto: any) => ({ ...dto })),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuthenticationLog), useFactory: makeRepoMock },
        { provide: getRepositoryToken(CriticalOperationLog), useFactory: makeRepoMock },
        { provide: getRepositoryToken(PasswordChangeLog), useFactory: makeRepoMock },
      ],
    }).compile();

    service = module.get(AuditLogService);
    authLogRepo = module.get(getRepositoryToken(AuthenticationLog));
    criticalLogRepo = module.get(getRepositoryToken(CriticalOperationLog));
    passwordLogRepo = module.get(getRepositoryToken(PasswordChangeLog));
  });

  // ── logAuthentication ──────────────────────────────────────────────────────

  describe('logAuthentication()', () => {
    it('deve criar e salvar um AuthenticationLog com todos os campos', async () => {
      await service.logAuthentication({
        tenantId: null,
        context: 'organization',
        success: true,
        loginUsed: 'admin@org.com',
        ipAddress: '10.0.0.1',
      });

      expect(authLogRepo.create).toHaveBeenCalledWith({
        tenantId: null,
        contextTypeId: 1, // organization → 1
        success: true,
        loginUsed: 'admin@org.com',
        ipAddress: '10.0.0.1',
      });
      expect(authLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('deve mapear context=tenant para contextTypeId=2', async () => {
      await service.logAuthentication({
        tenantId: 'tenant-uuid-1',
        context: 'tenant',
        success: false,
        loginUsed: 'user@company.com',
      });

      expect(authLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ contextTypeId: 2 }),
      );
    });

    it('deve mapear context=standalone para contextTypeId=3', async () => {
      await service.logAuthentication({
        tenantId: null,
        context: 'standalone',
        success: true,
        loginUsed: 'solo@user.com',
      });

      expect(authLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ contextTypeId: 3 }),
      );
    });

    it('deve usar ipAddress=null quando não fornecido', async () => {
      await service.logAuthentication({
        tenantId: null,
        context: 'organization',
        success: false,
        loginUsed: 'test@test.com',
      });

      expect(authLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: null }),
      );
    });
  });

  // ── logCriticalOperation ───────────────────────────────────────────────────

  describe('logCriticalOperation()', () => {
    it('deve criar e salvar um CriticalOperationLog com todos os campos', async () => {
      await service.logCriticalOperation({
        tenantId: 'tenant-uuid-1',
        tableName: 'users',
        operation: 'CREATE',
        recordId: 'user-uuid-new',
        userId: 'actor-uuid-1',
        ipAddress: '192.168.1.1',
      });

      expect(criticalLogRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-uuid-1',
        tableName: 'users',
        operation: 'CREATE',
        recordId: 'user-uuid-new',
        userId: 'actor-uuid-1',
        ipAddress: '192.168.1.1',
        diff: null,
      });
      expect(criticalLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('deve aceitar userId=null para operações do sistema', async () => {
      await service.logCriticalOperation({
        tenantId: null,
        tableName: 'user_roles',
        operation: 'UPDATE',
        recordId: 'user-uuid-1',
        userId: null,
        ipAddress: 'system',
      });

      expect(criticalLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, ipAddress: 'system' }),
      );
    });

    it('deve persistir diff quando fornecido', async () => {
      const diff = { name: { before: 'Old Name', after: 'New Name' } };

      await service.logCriticalOperation({
        tenantId: null,
        tableName: 'persons',
        operation: 'UPDATE',
        recordId: 'person-uuid-1',
        userId: 'actor-uuid-1',
        diff,
      });

      expect(criticalLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ diff }),
      );
    });

    it('deve persistir diff=null quando não fornecido', async () => {
      await service.logCriticalOperation({
        tenantId: null,
        tableName: 'users',
        operation: 'CREATE',
        recordId: 'user-uuid-new',
        userId: 'actor-uuid-1',
      });

      expect(criticalLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ diff: null }),
      );
    });

    it('deve suportar todas as operações: CREATE, UPDATE, DELETE, READ', async () => {
      const ops = ['CREATE', 'UPDATE', 'DELETE', 'READ'] as const;

      for (const operation of ops) {
        criticalLogRepo.create.mockClear();
        await service.logCriticalOperation({
          tenantId: null,
          tableName: 'tenants',
          operation,
          recordId: 'record-uuid-1',
          userId: null,
        });

        expect(criticalLogRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ operation }),
        );
      }
    });
  });

  // ── logPasswordChange ──────────────────────────────────────────────────────

  describe('logPasswordChange()', () => {
    it('deve criar e salvar um PasswordChangeLog com isSession=true', async () => {
      await service.logPasswordChange({
        tenantId: null,
        userId: 'user-uuid-1',
        isSession: true,
        ipAddress: '127.0.0.1',
      });

      expect(passwordLogRepo.create).toHaveBeenCalledWith({
        tenantId: null,
        userId: 'user-uuid-1',
        isSession: true,
        ipAddress: '127.0.0.1',
        usedToken: null,
      });
      expect(passwordLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('deve criar e salvar um PasswordChangeLog com isSession=false (recuperação)', async () => {
      await service.logPasswordChange({
        tenantId: 'tenant-uuid-1',
        userId: 'user-uuid-2',
        isSession: false,
        ipAddress: '10.0.0.5',
        usedToken: 'sha256-token-hash',
      });

      expect(passwordLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isSession: false,
          tenantId: 'tenant-uuid-1',
          usedToken: 'sha256-token-hash',
        }),
      );
    });
  });

  describe('isPasswordResetTokenAlreadyUsed()', () => {
    it('deve retornar true quando encontrar token já utilizado', async () => {
      passwordLogRepo.findOne.mockResolvedValue(makePasswordLog() as any);

      await expect(
        service.isPasswordResetTokenAlreadyUsed('sha256-token-hash'),
      ).resolves.toBe(true);

      expect(passwordLogRepo.findOne).toHaveBeenCalledWith({
        where: {
          isSession: false,
          usedToken: 'sha256-token-hash',
        },
        select: { id: true },
      });
    });

    it('deve retornar false quando token ainda não foi utilizado', async () => {
      passwordLogRepo.findOne.mockResolvedValue(null);

      await expect(
        service.isPasswordResetTokenAlreadyUsed('sha256-token-hash'),
      ).resolves.toBe(false);
    });
  });

  // ── findAuthenticationLogs ─────────────────────────────────────────────────

  describe('findAuthenticationLogs()', () => {
    it('deve retornar data e total sem filtros, usando paginação padrão', async () => {
      const logs = [makeAuthLog()];
      const qb = makeQbMock(logs, 1);
      authLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAuthenticationLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(qb.skip).toHaveBeenCalledWith(0); // page=1, limit=20 → skip=0
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('deve aplicar filtro de tenantId quando fornecido', async () => {
      const qb = makeQbMock([], 0);
      authLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAuthenticationLogs({ tenantId: 'tenant-uuid-1' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'al.tenant_id = :tenantId',
        { tenantId: 'tenant-uuid-1' },
      );
    });

    it('deve aplicar paginação correta para página 2 com limit 5', async () => {
      const qb = makeQbMock([], 0);
      authLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAuthenticationLogs({ page: 2, limit: 5 });

      expect(qb.skip).toHaveBeenCalledWith(5); // (2-1)*5
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('deve limitar o máximo de registros por página a 100', async () => {
      const qb = makeQbMock([], 0);
      authLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAuthenticationLogs({ limit: 999 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('deve aplicar filtros de from e to quando fornecidos', async () => {
      const qb = makeQbMock([], 0);
      authLogRepo.createQueryBuilder.mockReturnValue(qb as any);
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      await service.findAuthenticationLogs({ from, to });

      expect(qb.andWhere).toHaveBeenCalledWith('al.created_at >= :from', { from });
      expect(qb.andWhere).toHaveBeenCalledWith('al.created_at <= :to', { to });
    });
  });

  // ── findCriticalOperationLogs ──────────────────────────────────────────────

  describe('findCriticalOperationLogs()', () => {
    it('deve retornar logs de operações críticas com data e total', async () => {
      const logs = [makeCriticalLog()];
      const qb = makeQbMock(logs, 1);
      criticalLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findCriticalOperationLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
    });

    it('deve aplicar filtro de userId quando fornecido', async () => {
      const qb = makeQbMock([], 0);
      criticalLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findCriticalOperationLogs({ userId: 'actor-uuid-1' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'col.user_id = :userId',
        { userId: 'actor-uuid-1' },
      );
    });
  });

  // ── findPasswordChangeLogs ─────────────────────────────────────────────────

  describe('findPasswordChangeLogs()', () => {
    it('deve retornar logs de troca de senha com data e total', async () => {
      const logs = [makePasswordLog()];
      const qb = makeQbMock(logs, 1);
      passwordLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findPasswordChangeLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
    });

    it('deve aplicar filtros de userId e tenantId simultaneamente', async () => {
      const qb = makeQbMock([], 0);
      passwordLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.findPasswordChangeLogs({
        userId: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'pcl.user_id = :userId',
        { userId: 'user-uuid-1' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'pcl.tenant_id = :tenantId',
        { tenantId: 'tenant-uuid-1' },
      );
    });
  });
});
