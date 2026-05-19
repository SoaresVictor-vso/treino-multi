/**
 * Testes unitários do UsersService — Fase 4
 *
 * Pontos críticos:
 *  - Validação de contexto vs tenantId
 *  - Validação de roles vs contexto
 *  - Operações em transação (DataSource.transaction mock)
 *  - Hash de senha (bcrypt real nos testes)
 */

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

// ── fixtures ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    personId: 'person-uuid-1',
    tenantId: null,
    context: 'organization',
    passwordHash: '$2b$12$hashedpassword',
    isActive: true,
    deletedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [{ role: Role.ORG_ADMIN, deletedAt: null } as UserRole],
    person: { id: 'person-uuid-1', name: 'Admin', email: 'admin@org.com' } as any,
    tenant: null,
    refreshTokens: [],
    ...overrides,
  }) as User;

// ── mock do EntityManager (transação) ────────────────────────────────────────

const makeEmMock = (savedUser: User) => ({
  create: jest.fn((_entity: any, dto: any) => ({ ...dto })),
  save: jest.fn().mockResolvedValue(savedUser),
  softDelete: jest.fn().mockResolvedValue({}),
  findOneOrFail: jest.fn().mockResolvedValue(savedUser),
});

// ── testes ───────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            softRemove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: {},
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logCriticalOperation: jest.fn().mockResolvedValue(undefined),
            logPasswordChange: jest.fn().mockResolvedValue(undefined),
            isPasswordResetTokenAlreadyUsed: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              if (key === 'PASSWORD_RESET_SECRET') return 'password-reset-secret';
              return fallback;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
    auditLogService = module.get(AuditLogService);
    configService = module.get(ConfigService);
  });

  // ── validação de contexto/roles ───────────────────────────────────────────

  describe('validateContextAndRoles() — via create()', () => {
    it('deve lançar BadRequestException se context=tenant sem tenantId', async () => {
      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'tenant',
        tenantId: undefined,
        password: 'senha1234',
        roles: [Role.TENANT_ADMIN],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se context=organization com tenantId', async () => {
      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'organization',
        tenantId: 'tenant-uuid',
        password: 'senha1234',
        roles: [Role.ORG_ADMIN],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se role não é válida para o contexto', async () => {
      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'organization',
        password: 'senha1234',
        roles: [Role.TENANT_ADMIN], // role de tenant em contexto organization
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar org:admin em context=organization', async () => {
      const savedUser = makeUser();
      const emMock = makeEmMock(savedUser);
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'organization',
        password: 'senha1234',
        roles: [Role.ORG_ADMIN],
      };

      const result = await service.create(dto);

      expect(result).toEqual(savedUser);
    });

    it('deve aceitar tenant:admin em context=tenant com tenantId', async () => {
      const savedUser = makeUser({
        context: 'tenant',
        tenantId: 'tenant-uuid-1',
        userRoles: [{ role: Role.TENANT_ADMIN, deletedAt: null } as UserRole],
      });
      const emMock = makeEmMock(savedUser);
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'tenant',
        tenantId: 'tenant-uuid-1',
        password: 'senha1234',
        roles: [Role.TENANT_ADMIN],
      };

      const result = await service.create(dto);

      expect(result.tenantId).toBe('tenant-uuid-1');
    });

    it('deve aceitar standalone:user em context=standalone', async () => {
      const savedUser = makeUser({
        context: 'standalone',
        userRoles: [{ role: Role.STANDALONE_USER, deletedAt: null } as UserRole],
      });
      const emMock = makeEmMock(savedUser);
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'standalone',
        password: 'senha1234',
        roles: [Role.STANDALONE_USER],
      };

      const result = await service.create(dto);

      expect(result.context).toBe('standalone');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('deve persistir com senha hasheada (diferente da original)', async () => {
      const emMock = makeEmMock(makeUser());
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: CreateUserDto = {
        personId: 'p-uuid',
        context: 'organization',
        password: 'minha-senha-clara',
        roles: [Role.ORG_ADMIN],
      };

      await service.create(dto);

      // Verifica que o objeto passado ao create do EM tem passwordHash (não password)
      const callArgs = emMock.create.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('passwordHash');
      expect(callArgs[1].passwordHash).not.toBe('minha-senha-clara');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar lista de usuários', async () => {
      const list = [makeUser()];
      userRepo.find.mockResolvedValue(list);

      const result = await service.findAll();

      expect(userRepo.find).toHaveBeenCalledWith({
        relations: ['person', 'userRoles'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(list);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar o User quando o id existe', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('user-uuid-1');

      expect(result).toEqual(user);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('deve atualizar isActive sem alterar password', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const updatedUser = { ...user, isActive: false };
      const emMock = makeEmMock(updatedUser as User);
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: UpdateUserDto = { isActive: false };
      const result = await service.update('user-uuid-1', dto);

      expect(result.isActive).toBe(false);
    });

    it('deve substituir roles quando dto.roles é informado', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const updatedUser = makeUser({
        userRoles: [{ role: Role.ORG_SUPPORT, deletedAt: null } as UserRole],
      });
      const emMock = makeEmMock(updatedUser);
      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const dto: UpdateUserDto = { roles: [Role.ORG_SUPPORT] };
      await service.update('user-uuid-1', dto);

      // Deve ter revogado as roles antigas (softDelete)
      expect(emMock.softDelete).toHaveBeenCalledWith(UserRole, {
        userId: 'user-uuid-1',
      });
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve aplicar soft delete no User existente', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.softRemove.mockResolvedValue(user);

      await expect(service.remove('user-uuid-1')).resolves.toBeUndefined();
      expect(userRepo.softRemove).toHaveBeenCalledWith(user);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetPassword()', () => {
    it('deve lançar UnauthorizedException quando token já foi utilizado', async () => {
      const token = jwt.sign(
        { sub: 'user-uuid-1', purpose: 'password-reset' },
        'password-reset-secret',
        { expiresIn: '30m' },
      );

      auditLogService.isPasswordResetTokenAlreadyUsed.mockResolvedValue(true);

      await expect(service.resetPassword(token, 'NovaSenha@123')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(auditLogService.isPasswordResetTokenAlreadyUsed).toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('deve salvar hash do token usado ao redefinir senha com sucesso', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue(undefined as any);

      const token = jwt.sign(
        { sub: user.id, purpose: 'password-reset' },
        'password-reset-secret',
        { expiresIn: '30m' },
      );

      await service.resetPassword(token, 'NovaSenha@123', '127.0.0.1');

      const expectedUsedTokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      expect(configService.get).toHaveBeenCalledWith('PASSWORD_RESET_SECRET');
      expect(auditLogService.isPasswordResetTokenAlreadyUsed).toHaveBeenCalledWith(
        expectedUsedTokenHash,
      );
      expect(auditLogService.logPasswordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isSession: false,
          userId: user.id,
          tenantId: user.tenantId,
          usedToken: expectedUsedTokenHash,
        }),
      );
    });
  });
});
