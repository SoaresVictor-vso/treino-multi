/**
 * Testes unitários do AuditLogsController — Fase 5
 *
 * Estratégia: mock do AuditLogService.
 * Verificamos:
 *  - Cada endpoint delega corretamente ao service
 *  - Os parâmetros de query são parseados e repassados como filtros
 *  - A resposta inclui data, total, page e limit
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogService } from './audit-logs.service';
import { AuthenticationLog } from './entities/authentication-log.entity';
import { CriticalOperationLog } from './entities/critical-operation-log.entity';
import { PasswordChangeLog } from './entities/password-change-log.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

// ── fixtures ──────────────────────────────────────────────────────────────────

const makeAuthLog = (): AuthenticationLog =>
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
  }) as AuthenticationLog;

const makeCriticalLog = (): CriticalOperationLog =>
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
  }) as CriticalOperationLog;

const makePasswordLog = (): PasswordChangeLog =>
  ({
    id: 'pw-log-uuid-1',
    tenantId: null,
    userId: 'user-uuid-1',
    isSession: true,
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    tenant: null,
    user: null as any,
  }) as PasswordChangeLog;

// ── setup do módulo de teste ──────────────────────────────────────────────────

describe('AuditLogsController', () => {
  let controller: AuditLogsController;
  let service: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        {
          provide: AuditLogService,
          useValue: {
            findAuthenticationLogs: jest.fn(),
            findCriticalOperationLogs: jest.fn(),
            findPasswordChangeLogs: jest.fn(),
          },
        },
      ],
    })
      // Desabilita guards para isolar o controller da infra de autenticação
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuditLogsController);
    service = module.get(AuditLogService);
  });

  // ── getAuthenticationLogs ─────────────────────────────────────────────────

  describe('GET /audit-logs/authentication', () => {
    it('deve retornar data, total, page e limit com valores padrão', async () => {
      const logs = [makeAuthLog()];
      service.findAuthenticationLogs.mockResolvedValue({ data: logs, total: 1 });

      const result = await controller.getAuthenticationLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve repassar parâmetros de paginação ao service', async () => {
      service.findAuthenticationLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getAuthenticationLogs({ page: '3', limit: '10' });

      expect(service.findAuthenticationLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 10 }),
      );
    });

    it('deve repassar tenantId como filtro ao service', async () => {
      service.findAuthenticationLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getAuthenticationLogs({ tenantId: 'tenant-uuid-1' });

      expect(service.findAuthenticationLogs).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-uuid-1' }),
      );
    });

    it('deve converter strings de data para objetos Date', async () => {
      service.findAuthenticationLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getAuthenticationLogs({
        from: '2024-01-01',
        to: '2024-12-31',
      });

      const call = service.findAuthenticationLogs.mock.calls[0][0];
      expect(call.from).toBeInstanceOf(Date);
      expect(call.to).toBeInstanceOf(Date);
    });

    it('deve limitar page ao mínimo de 1 para valores inválidos', async () => {
      service.findAuthenticationLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getAuthenticationLogs({ page: '-5' });

      expect(service.findAuthenticationLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  // ── getCriticalOperationLogs ──────────────────────────────────────────────

  describe('GET /audit-logs/critical-operations', () => {
    it('deve retornar data, total, page e limit', async () => {
      const logs = [makeCriticalLog()];
      service.findCriticalOperationLogs.mockResolvedValue({ data: logs, total: 1 });

      const result = await controller.getCriticalOperationLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve repassar userId ao service quando fornecido', async () => {
      service.findCriticalOperationLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getCriticalOperationLogs({ userId: 'user-uuid-1' });

      expect(service.findCriticalOperationLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-uuid-1' }),
      );
    });
  });

  // ── getPasswordChangeLogs ─────────────────────────────────────────────────

  describe('GET /audit-logs/password-changes', () => {
    it('deve retornar data, total, page e limit', async () => {
      const logs = [makePasswordLog()];
      service.findPasswordChangeLogs.mockResolvedValue({ data: logs, total: 1 });

      const result = await controller.getPasswordChangeLogs({});

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve repassar filtros combinados (userId + tenantId)', async () => {
      service.findPasswordChangeLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getPasswordChangeLogs({
        userId: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
      });

      expect(service.findPasswordChangeLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          tenantId: 'tenant-uuid-1',
        }),
      );
    });

    it('deve limitar o limit ao máximo de 100', async () => {
      service.findPasswordChangeLogs.mockResolvedValue({ data: [], total: 0 });

      await controller.getPasswordChangeLogs({ limit: '999' });

      expect(service.findPasswordChangeLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });
  });
});
