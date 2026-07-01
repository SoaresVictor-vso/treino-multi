import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantFullDto } from './dto/create-tenant-full.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../common/enums/role.enum';

const normalizeNullableString = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
};

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateTenantFullDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<Tenant> {
    const { tenant: tenantDto, admin: adminDto } = dto;

    const existing = await this.tenantRepo.findOne({
      where: { slug: tenantDto.slug },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`Slug "${tenantDto.slug}" já está em uso.`);
    }

    const existingPersonByEmail = await this.personRepo.findOne({
      where: { email: adminDto.email },
    });
    if (existingPersonByEmail) {
      throw new ConflictException(`E-mail ${adminDto.email} já está em uso.`);
    }

    const existingPersonByDocument = await this.personRepo.findOne({
      where: { document: adminDto.cpf },
    });
    if (existingPersonByDocument) {
      throw new ConflictException(
        `Documento ${adminDto.cpf} já está em uso.`,
      );
    }

    const passwordHash = await bcrypt.hash(adminDto.password, 12);

    const created = await this.dataSource.transaction(async (em) => {
      const tenant = await em.save(
        Tenant,
        em.create(Tenant, {
          name: tenantDto.trade_name,
          tradeName: tenantDto.trade_name,
          registeredName: normalizeNullableString(tenantDto.registered_name),
          slug: tenantDto.slug,
          cnpj: normalizeNullableString(tenantDto.cnpj),
          phone: normalizeNullableString(tenantDto.phone),
          email: normalizeNullableString(tenantDto.email),
          isActive: true,
        }),
      );

      const person = await em.save(
        Person,
        em.create(Person, {
          name: adminDto.name,
          email: adminDto.email,
          document: adminDto.cpf,
          phone: adminDto.phone,
        }),
      );

      const user = await em.save(
        User,
        em.create(User, {
          personId: person.id,
          tenantId: tenant.id,
          context: 'tenant',
          passwordHash,
          isActive: true,
        }),
      );

      await em.save(
        UserRole,
        em.create(UserRole, {
          userId: user.id,
          role: Role.TENANT_ADMIN,
        }),
      );

      return { tenant, person, user };
    });

    await this.auditLogService.logCriticalOperation({
      tenantId: null, // criação de tenant é uma ação da organização
      tableName: 'tenants',
      operation: 'CREATE',
      recordId: created.tenant.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    await this.auditLogService.logCriticalOperation({
      tenantId: created.tenant.id,
      tableName: 'persons',
      operation: 'CREATE',
      recordId: created.person.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    await this.auditLogService.logCriticalOperation({
      tenantId: created.tenant.id,
      tableName: 'users',
      operation: 'CREATE',
      recordId: created.user.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    return created.tenant;
  }

  async findAll(
    includeInactive = false,
    name?: string,
    filter?: string,
  ): Promise<Tenant[]> {
    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.trade_name', 'ASC');

    if (!includeInactive) {
      qb.andWhere('t.is_active = :active', { active: true });
    }

    if (filter === 'name' && name) {
      qb.andWhere('t.trade_name ILIKE :name', { name: `%${name}%` });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado.`);
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { slug } });
  }

  async update(
    id: string,
    dto: UpdateTenantDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (dto.slug && dto.slug !== tenant.slug) {
      const conflict = await this.tenantRepo.findOne({
        where: { slug: dto.slug },
        withDeleted: true,
      });
      if (conflict) {
        throw new ConflictException(`Slug "${dto.slug}" já está em uso.`);
      }
    }

    if (dto.trade_name !== undefined) {
      tenant.name = dto.trade_name;
      tenant.tradeName = dto.trade_name;
    }
    if (dto.slug !== undefined) {
      tenant.slug = dto.slug;
    }
    if (dto.cnpj !== undefined) {
      tenant.cnpj = normalizeNullableString(dto.cnpj);
    }
    if (dto.phone !== undefined) {
      tenant.phone = normalizeNullableString(dto.phone);
    }
    if (dto.email !== undefined) {
      tenant.email = normalizeNullableString(dto.email);
    }
    if (dto.registered_name !== undefined) {
      tenant.registeredName = normalizeNullableString(dto.registered_name);
    }
    const saved = await this.tenantRepo.save(tenant);
    await this.auditLogService.logCriticalOperation({
      tenantId: null,
      tableName: 'tenants',
      operation: 'UPDATE',
      recordId: id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    return saved;
  }

  async remove(
    id: string,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepo.softRemove(tenant);
    await this.auditLogService.logCriticalOperation({
      tenantId: null,
      tableName: 'tenants',
      operation: 'DELETE',
      recordId: id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
  }
}
