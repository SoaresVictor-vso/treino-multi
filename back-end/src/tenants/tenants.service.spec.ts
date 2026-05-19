/**
 * Testes unitários do TenantsService — Fase 4
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

// ── fixtures ─────────────────────────────────────────────────────────────────

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 'tenant-uuid-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    users: [],
    ...overrides,
  }) as Tenant;

// ── helpers para mock de QueryBuilder ────────────────────────────────────────

const makeQb = (result: Tenant[]): Partial<SelectQueryBuilder<Tenant>> => ({
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(result),
});

// ── testes ───────────────────────────────────────────────────────────────────

describe('TenantsService', () => {
  let service: TenantsService;
  let repo: jest.Mocked<Repository<Tenant>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto) => ({ ...dto })),
            save: jest.fn(),
            softRemove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logCriticalOperation: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(TenantsService);
    repo = module.get(getRepositoryToken(Tenant));
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateTenantDto = { name: 'Acme Corp', slug: 'acme-corp' };

    it('deve criar e retornar o Tenant quando o slug não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      const expected = makeTenant();
      repo.save.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { slug: dto.slug },
        withDeleted: true,
      });
      expect(result).toEqual(expected);
    });

    it('deve lançar ConflictException quando o slug já existe', async () => {
      repo.findOne.mockResolvedValue(makeTenant());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('deve definir isActive=true por padrão quando não informado', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (t: any) => t);

      await service.create({ name: 'X', slug: 'x' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('deve respeitar isActive=false quando informado explicitamente', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (t: any) => t);

      await service.create({ name: 'X', slug: 'x', isActive: false });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar apenas tenants ativos por padrão', async () => {
      const list = [makeTenant()];
      const qb = makeQb(list);
      repo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll();

      expect(qb.andWhere).toHaveBeenCalledWith('t.is_active = :active', {
        active: true,
      });
      expect(result).toEqual(list);
    });

    it('deve retornar todos os tenants quando includeInactive=true', async () => {
      const list = [makeTenant(), makeTenant({ id: 'uuid-2', isActive: false })];
      const qb = makeQb(list);
      repo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findAll(true);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar o Tenant quando o id existe', async () => {
      const tenant = makeTenant();
      repo.findOne.mockResolvedValue(tenant);

      const result = await service.findOne('tenant-uuid-1');

      expect(result).toEqual(tenant);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('deve atualizar e retornar o Tenant', async () => {
      const tenant = makeTenant();
      repo.findOne.mockResolvedValue(tenant);
      repo.save.mockResolvedValue({ ...tenant, name: 'Novo Nome' } as Tenant);

      const dto: UpdateTenantDto = { name: 'Novo Nome' };
      const result = await service.update('tenant-uuid-1', dto);

      expect(result.name).toBe('Novo Nome');
    });

    it('deve lançar ConflictException ao trocar para slug já existente', async () => {
      const tenant = makeTenant();
      repo.findOne
        .mockResolvedValueOnce(tenant)             // findOne pelo id
        .mockResolvedValueOnce(makeTenant({ id: 'outro-uuid', slug: 'outro-slug' })); // conflito no slug

      await expect(
        service.update('tenant-uuid-1', { slug: 'outro-slug' }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve aplicar soft delete no Tenant existente', async () => {
      const tenant = makeTenant();
      repo.findOne.mockResolvedValue(tenant);
      repo.softRemove.mockResolvedValue(tenant);

      await expect(service.remove('tenant-uuid-1')).resolves.toBeUndefined();
      expect(repo.softRemove).toHaveBeenCalledWith(tenant);
    });

    it('deve lançar NotFoundException quando o id não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug()', () => {
    it('deve retornar o Tenant quando o slug existe', async () => {
      const tenant = makeTenant();
      repo.findOne.mockResolvedValue(tenant);

      const result = await service.findBySlug('acme-corp');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: 'acme-corp' } });
      expect(result).toEqual(tenant);
    });

    it('deve retornar null quando o slug não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findBySlug('inexistente');

      expect(result).toBeNull();
    });
  });
});
