import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateTenantDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({
      where: { slug: dto.slug },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" já está em uso.`);
    }

    const existingPersonByEmail = await this.personRepo.findOne({
      where: { email: dto.admin.email },
    });
    if (existingPersonByEmail) {
      throw new ConflictException(`E-mail ${dto.admin.email} já está em uso.`);
    }

    const existingPersonByDocument = await this.personRepo.findOne({
      where: { document: dto.admin.cpf },
    });
    if (existingPersonByDocument) {
      throw new ConflictException(
        `Documento ${dto.admin.cpf} já está em uso.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 12);

    const saved = await this.dataSource.transaction(async (em) => {
      const tenant = await em.save(
        Tenant,
        em.create(Tenant, {
          name: dto.trade_name,
          slug: dto.slug,
          isActive: dto.isActive ?? true,
        }),
      );

      const person = await em.save(
        Person,
        em.create(Person, {
          name: dto.admin.name,
          email: dto.admin.email,
          document: dto.admin.cpf,
          phone: dto.admin.phone,
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

      return tenant;
    });

    await this.auditLogService.logCriticalOperation({
      tenantId: null, // criação de tenant é uma ação da organização
      tableName: 'tenants',
      operation: 'CREATE',
      recordId: saved.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    const adminPerson = await this.personRepo.findOneOrFail({
      where: { email: dto.admin.email },
    });
    await this.auditLogService.logCriticalOperation({
      tenantId: saved.id,
      tableName: 'persons',
      operation: 'CREATE',
      recordId: adminPerson.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    const adminUser = await this.userRepo.findOneOrFail({
      where: { personId: adminPerson.id, tenantId: saved.id },
    });
    await this.auditLogService.logCriticalOperation({
      tenantId: saved.id,
      tableName: 'users',
      operation: 'CREATE',
      recordId: adminUser.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    return saved;
  }

  async findAll(
    includeInactive = false,
    name?: string,
    filter?: string,
  ): Promise<Tenant[]> {
    const qb = this.tenantRepo.createQueryBuilder('t').orderBy('t.name', 'ASC');

    if (!includeInactive) {
      qb.andWhere('t.is_active = :active', { active: true });
    }

    if (filter === 'name' && name) {
      qb.andWhere('t.name ILIKE :name', { name: `%${name}%` });
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
    }
    if (dto.slug !== undefined) {
      tenant.slug = dto.slug;
    }
    if (dto.isActive !== undefined) {
      tenant.isActive = dto.isActive;
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
