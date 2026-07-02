/**
 * Testes unitários do UsersService — Fase 4
 *
 * Pontos críticos:
 *  - Criação transacional de Person + User
 *  - Listagem com cursor e filtros combinados
 *  - Atualização dos dados editáveis da Person
 *  - Reset de senha com token
 */

import {
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
import { Role } from '../common/enums/role.enum';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { Person } from '../persons/entities/person.entity';
import { UserOrderBy } from './dto/find-users-query.dto';

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

// ── testes ───────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;
  let personRepo: jest.Mocked<Repository<Person>>;
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
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
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
    personRepo = module.get(getRepositoryToken(Person));
    dataSource = module.get(DataSource);
    auditLogService = module.get(AuditLogService);
    configService = module.get(ConfigService);
  });

  describe('createManagedUser()', () => {
    it('deve criar Person e User na mesma transação, aceitando role/context livres', async () => {
      const savedUser = makeUser({
        personId: 'person-uuid-2',
        tenantId: 'tenant-uuid-1',
        context: 'tenant',
        userRoles: [{ role: Role.ORG_SUPPORT, deletedAt: null } as UserRole],
        person: {
          id: 'person-uuid-2',
          name: 'Nova Pessoa',
          email: 'nova@org.com',
          document: '12345678901',
          phone: '11999990000',
        } as any,
      });

      const emMock = {
        create: jest.fn((_entity: any, dto: any) => ({ ...dto })),
        save: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'person-uuid-2',
            name: 'Nova Pessoa',
            email: 'nova@org.com',
            document: '12345678901',
            phone: '11999990000',
          })
          .mockResolvedValueOnce({
            id: 'user-uuid-2',
            personId: 'person-uuid-2',
            tenantId: 'tenant-uuid-1',
            context: 'tenant',
          })
          .mockResolvedValueOnce([{ userId: 'user-uuid-2', role: Role.ORG_SUPPORT }]),
        findOne: jest.fn().mockResolvedValue(null),
        findOneOrFail: jest.fn().mockResolvedValue(savedUser),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => cb(emMock));

      const result = await service.createManagedUser({
        name: 'Nova Pessoa',
        email: 'nova@org.com',
        document: '12345678901',
        fone: '11999990000',
        tenantId: 'tenant-uuid-1',
        context: 'tenant',
        password: 'Senha@123',
        roles: [Role.ORG_SUPPORT],
      });

      expect(result).toEqual(savedUser);
      expect(emMock.create).toHaveBeenCalledWith(
        Person,
        expect.objectContaining({
          name: 'Nova Pessoa',
          email: 'nova@org.com',
          phone: '11999990000',
        }),
      );
      expect(auditLogService.logCriticalOperation).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'persons', operation: 'CREATE' }),
      );
      expect(auditLogService.logCriticalOperation).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'users', operation: 'CREATE' }),
      );
    });
  });

  describe('findManagedUsers()', () => {
    it('deve aplicar paginação e filtros combinados', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[makeUser()], 1]),
      };

      userRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findManagedUsers({
        tenantId: 'null',
        name: 'Admin',
        role: Role.ORG_ADMIN,
        orderBy: UserOrderBy.NAME,
        start: 'Aaron',
        limit: '10',
      });

      expect(qb.orderBy).toHaveBeenCalledWith('person.name', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('user.id', 'ASC');
      expect(qb.andWhere).toHaveBeenCalledWith('user.tenantId IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(person.name) LIKE :personName',
        { personName: '%admin%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('person.name > :start', {
        start: 'Aaron',
      });
      expect(qb.innerJoin).toHaveBeenCalledWith(
        'user.userRoles',
        'roleFilter',
        'roleFilter.deletedAt IS NULL AND roleFilter.role = :role',
        { role: Role.ORG_ADMIN },
      );
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [expect.any(Object)],
        total: 1,
        limit: 10,
        orderBy: UserOrderBy.NAME,
        nextStart: 'Admin',
      });
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

  describe('updateManagedUser()', () => {
    it('deve atualizar os campos editáveis da Person', async () => {
      const user = makeUser({
        person: {
          id: 'person-uuid-1',
          name: 'Admin',
          email: 'old@org.com',
          document: '12345678901',
          phone: '11999990000',
        } as any,
      });

      const updatedUser = makeUser({
        person: {
          id: 'person-uuid-1',
          name: 'Nome Novo',
          email: 'novo@org.com',
          document: '10987654321',
          phone: '11888887777',
        } as any,
      });

      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(updatedUser);
      personRepo.findOne.mockResolvedValue(null);
      personRepo.save.mockResolvedValue(updatedUser.person as Person);

      const result = await service.updateManagedUser('user-uuid-1', {
        name: 'Nome Novo',
        email: 'novo@org.com',
        document: '10987654321',
        fone: '11888887777',
      });

      expect(personRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nome Novo',
          email: 'novo@org.com',
          document: '10987654321',
          phone: '11888887777',
        }),
      );
      expect(auditLogService.logCriticalOperation).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'persons', operation: 'UPDATE' }),
      );
      expect(auditLogService.logCriticalOperation).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'users', operation: 'UPDATE' }),
      );
      expect(result).toEqual(updatedUser);
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
