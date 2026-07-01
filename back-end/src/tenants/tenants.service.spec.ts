/**
 * Testes unitários do TenantsService.
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../common/enums/role.enum';
import { CreateTenantFullDto } from './dto/create-tenant-full.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 'tenant-uuid-1',
    name: 'Acme Corp',
    tradeName: 'Acme Corp',
    registeredName: 'Acme Corp LTDA',
    slug: 'acme-corp',
    cnpj: '12345678000199',
    phone: '1133334444',
    email: 'contato@acme.com',
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    users: [],
    ...overrides,
  }) as Tenant;

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid-1',
    name: 'Admin Acme',
    email: 'admin@acme.com',
    document: '12345678901',
    phone: '11999990000',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    users: [],
    ...overrides,
  }) as Person;

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    personId: 'person-uuid-1',
    tenantId: 'tenant-uuid-1',
    context: 'tenant',
    passwordHash: 'hashed-password',
    isActive: true,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    person: makePerson(),
    tenant: makeTenant(),
    userRoles: [],
    refreshTokens: [],
    ...overrides,
  }) as User;

const makeQb = (result: Tenant[]): Partial<SelectQueryBuilder<Tenant>> => ({
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(result),
});

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepo: jest.Mocked<Repository<Tenant>>;
  let personRepo: jest.Mocked<Repository<Person>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let dataSource: { transaction: jest.Mock };
  let auditLogService: { logCriticalOperation: jest.Mock };

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn(),
    };

    auditLogService = {
      logCriticalOperation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            softRemove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get(TenantsService);
    tenantRepo = module.get(getRepositoryToken(Tenant));
    personRepo = module.get(getRepositoryToken(Person));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('create()', () => {
    const dto: CreateTenantFullDto = {
      tenant: {
        trade_name: 'Acme Corp',
        slug: 'acme-corp',
        cnpj: '12345678000199',
        registered_name: 'Acme Corp LTDA',
        phone: '1133334444',
        email: 'contato@acme.com',
      },
      admin: {
        name: 'Admin Acme',
        email: 'admin@acme.com',
        cpf: '12345678901',
        phone: '11999990000',
        password: 'S3nh@F0rt3!',
      },
    };

    it('deve criar tenant ativo com person, user e role de admin em transação', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      personRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const tenant = makeTenant();
      const person = makePerson();
      const user = makeUser();
      const em = {
        create: jest
          .fn()
          .mockImplementation((_entity, data) => ({ ...data })),
        save: jest
          .fn()
          .mockImplementation(async (entity, data) => {
            if (entity === Tenant) return { ...tenant, ...data };
            if (entity === Person) return { ...person, ...data };
            if (entity === User) return { ...user, ...data };
            if (entity === UserRole) return data;
            return data;
          }),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(em));

      const result = await service.create(dto, 'actor-uuid', '127.0.0.1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(em.create).toHaveBeenCalledWith(
        Tenant,
        expect.objectContaining({
          name: dto.tenant.trade_name,
          tradeName: dto.tenant.trade_name,
          registeredName: dto.tenant.registered_name,
          slug: dto.tenant.slug,
          cnpj: dto.tenant.cnpj,
          phone: dto.tenant.phone,
          email: dto.tenant.email,
          isActive: true,
        }),
      );
      expect(em.create).toHaveBeenCalledWith(
        Person,
        expect.objectContaining({
          name: dto.admin.name,
          email: dto.admin.email,
          document: dto.admin.cpf,
          phone: dto.admin.phone,
        }),
      );
      expect(em.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          personId: person.id,
          tenantId: tenant.id,
          context: 'tenant',
          isActive: true,
        }),
      );
      expect(em.create).toHaveBeenCalledWith(
        UserRole,
        expect.objectContaining({
          userId: user.id,
          role: Role.TENANT_ADMIN,
        }),
      );
      expect(auditLogService.logCriticalOperation).toHaveBeenCalledTimes(3);
      expect(result).toEqual(expect.objectContaining({ id: tenant.id }));
    });

    it('deve lançar ConflictException quando o slug já existe', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando o e-mail do admin já existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      personRepo.findOne.mockResolvedValueOnce(makePerson());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando o documento do admin já existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      personRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makePerson());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve salvar cnpj e registered_name como null quando vierem vazios', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      personRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const tenant = makeTenant({ cnpj: null, registeredName: null });
      const person = makePerson();
      const user = makeUser();
      const em = {
        create: jest
          .fn()
          .mockImplementation((_entity, data) => ({ ...data })),
        save: jest
          .fn()
          .mockImplementation(async (entity, data) => {
            if (entity === Tenant) return { ...tenant, ...data };
            if (entity === Person) return { ...person, ...data };
            if (entity === User) return { ...user, ...data };
            if (entity === UserRole) return data;
            return data;
          }),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(em));

      await service.create({
        ...dto,
        tenant: {
          ...dto.tenant,
          cnpj: '',
          registered_name: '',
        },
      });

      expect(em.create).toHaveBeenCalledWith(
        Tenant,
        expect.objectContaining({
          cnpj: null,
          registeredName: null,
          phone: dto.tenant.phone,
          email: dto.tenant.email,
        }),
      );
    });
  });

  describe('findAll()', () => {
    it('deve retornar apenas tenants ativos por padrão', async () => {
      const list = [makeTenant()];
      const qb = makeQb(list);
      tenantRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll();

      expect(qb.andWhere).toHaveBeenCalledWith('t.is_active = :active', {
        active: true,
      });
      expect(result).toEqual(list);
    });

    it('deve retornar todos os tenants quando includeInactive=true', async () => {
      const list = [makeTenant(), makeTenant({ id: 'uuid-2', isActive: false })];
      const qb = makeQb(list);
      tenantRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll(true);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne()', () => {
    it('deve retornar o Tenant quando o id existe', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findOne('tenant-uuid-1');

      expect(result).toEqual(tenant);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findDetails()', () => {
    it('deve retornar o tenant com os dados do admin principal', async () => {
      const tenant = makeTenant();
      const adminUser = makeUser();
      tenantRepo.findOne.mockResolvedValue(tenant);

      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(adminUser),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findDetails('tenant-uuid-1');

      expect(result).toEqual({
        ...tenant,
        admin: {
          name: adminUser.person.name,
          email: adminUser.person.email,
          cpf: adminUser.person.document,
          phone: adminUser.person.phone,
        },
      });
    });

    it('deve retornar admin null quando não existir usuário admin para o tenant', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);

      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findDetails('tenant-uuid-1');

      expect(result).toEqual({
        ...tenant,
        admin: null,
      });
    });
  });

  describe('findBySlug()', () => {
    it('deve retornar o Tenant quando o slug existe', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findBySlug('acme-corp');

      expect(tenantRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'acme-corp' },
      });
      expect(result).toEqual(tenant);
    });

    it('deve retornar null quando o slug não existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      const result = await service.findBySlug('inexistente');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    it('deve atualizar e retornar o Tenant', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);
      tenantRepo.save.mockResolvedValue({
        ...tenant,
        name: 'Novo Nome',
        tradeName: 'Novo Nome',
        phone: '11999990000',
        email: 'novo@acme.com',
      } as Tenant);

      const dto: UpdateTenantDto = {
        trade_name: 'Novo Nome',
        phone: '11999990000',
        email: 'novo@acme.com',
      };
      const result = await service.update('tenant-uuid-1', dto);

      expect(result.name).toBe('Novo Nome');
      expect(result.tradeName).toBe('Novo Nome');
      expect(result.phone).toBe('11999990000');
      expect(result.email).toBe('novo@acme.com');
    });

    it('deve converter cnpj e registered_name vazios para null no update', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);
      tenantRepo.save.mockImplementation(async (value) => value as Tenant);

      const result = await service.update('tenant-uuid-1', {
        cnpj: '',
        registered_name: '',
      });

      expect(result.cnpj).toBeNull();
      expect(result.registeredName).toBeNull();
    });

    it('deve lançar ConflictException ao trocar para slug já existente', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne
        .mockResolvedValueOnce(tenant)
        .mockResolvedValueOnce(
          makeTenant({ id: 'outro-uuid', slug: 'outro-slug' }),
        );

      await expect(
        service.update('tenant-uuid-1', { slug: 'outro-slug' }),
      ).rejects.toThrow(ConflictException);

      expect(tenantRepo.save).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { trade_name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('deve aplicar soft delete no Tenant existente', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);
      tenantRepo.softRemove.mockResolvedValue(tenant);

      await expect(service.remove('tenant-uuid-1')).resolves.toBeUndefined();
      expect(tenantRepo.softRemove).toHaveBeenCalledWith(tenant);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
