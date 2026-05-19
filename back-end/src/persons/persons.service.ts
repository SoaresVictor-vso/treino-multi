import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './entities/person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreatePersonDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<Person> {
    const existing = await this.personRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(`E-mail ${dto.email} já está em uso.`);
    }
    const saved = await this.personRepo.save(this.personRepo.create(dto));
    await this.auditLogService.logCriticalOperation({
      tenantId: null,
      tableName: 'persons',
      operation: 'CREATE',
      recordId: saved.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
    return saved;
  }

  async findAll(): Promise<Person[]> {
    return this.personRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Person> {
    const person = await this.personRepo.findOne({ where: { id } });
    if (!person) {
      throw new NotFoundException(`Person ${id} não encontrada.`);
    }
    return person;
  }

  async update(
    id: string,
    dto: UpdatePersonDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<Person> {
    const person = await this.findOne(id);

    if (dto.email && dto.email !== person.email) {
      const conflict = await this.personRepo.findOne({
        where: { email: dto.email },
      });
      if (conflict) {
        throw new ConflictException(`E-mail ${dto.email} já está em uso.`);
      }
    }

    Object.assign(person, dto);
    const saved = await this.personRepo.save(person);
    await this.auditLogService.logCriticalOperation({
      tenantId: null,
      tableName: 'persons',
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
    const person = await this.findOne(id);
    await this.personRepo.remove(person);
    await this.auditLogService.logCriticalOperation({
      tenantId: null,
      tableName: 'persons',
      operation: 'DELETE',
      recordId: id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
  }
}
