import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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
    const saved = await this.tenantRepo.save(
      this.tenantRepo.create({ ...dto, isActive: dto.isActive ?? true }),
    );
    await this.auditLogService.logCriticalOperation({
      tenantId: null, // criação de tenant é uma ação da organização
      tableName: 'tenants',
      operation: 'CREATE',
      recordId: saved.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    return saved;
  }

  async findAll(includeInactive = false, name?: string, filter?: string): Promise<Tenant[]> {
    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.name', 'ASC');

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

    Object.assign(tenant, dto);
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
