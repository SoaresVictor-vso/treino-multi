import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { Person } from '../persons/entities/person.entity';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { FindUsersQueryDto, UserOrderBy } from './dto/find-users-query.dto';

const USER_ORDERING = {
  [UserOrderBy.ID]: {
    column: 'user.id',
    direction: 'ASC' as const,
    readValue: (user: User) => user.id,
  },
  [UserOrderBy.CREATED_AT]: {
    column: 'user.createdAt',
    direction: 'DESC' as const,
    readValue: (user: User) => user.createdAt.toISOString(),
  },
  [UserOrderBy.UPDATED_AT]: {
    column: 'user.updatedAt',
    direction: 'DESC' as const,
    readValue: (user: User) => user.updatedAt.toISOString(),
  },
  [UserOrderBy.NAME]: {
    column: 'person.name',
    direction: 'ASC' as const,
    readValue: (user: User) => user.person.name,
  },
} satisfies Record<
  UserOrderBy,
  {
    column: string;
    direction: 'ASC' | 'DESC';
    readValue: (user: User) => string;
  }
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) { }

  async createManagedUser(
    dto: CreateManagedUserDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.dataSource.transaction(async (em) => {
      await this.ensurePersonUniqueness(
        em,
        dto.email,
        dto.document ?? null,
      );

      const person = await em.save(
        Person,
        em.create(Person, {
          name: dto.name,
          email: dto.email,
          document: dto.document ?? null,
          phone: dto.fone ?? null,
        }),
      );

      const user = await em.save(
        User,
        em.create(User, {
          personId: person.id,
          tenantId: dto.tenantId ?? null,
          context: dto.context,
          passwordHash,
          isActive: true,
        }),
      );

      const roleEntities = dto.roles.map((role) =>
        em.create(UserRole, { userId: user.id, role }),
      );
      await em.save(UserRole, roleEntities);

      const result = await em.findOneOrFail(User, {
        where: { id: user.id },
        relations: ['person', 'tenant', 'userRoles'],
      });

      await this.auditLogService.logCriticalOperation({
        tenantId: result.tenantId,
        tableName: 'persons',
        operation: 'CREATE',
        recordId: person.id,
        userId: actorUserId ?? null,
        ipAddress: ipAddress ?? null,
      });

      await this.auditLogService.logCriticalOperation({
        tenantId: result.tenantId,
        tableName: 'users',
        operation: 'CREATE',
        recordId: result.id,
        userId: actorUserId ?? null,
        ipAddress: ipAddress ?? null,
      });

      return result;
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['person', 'userRoles', 'tenant'],
    });
    if (!user) throw new NotFoundException(`User ${id} não encontrado.`);
    return user;
  }

  async findManagedUsers(
    dto: FindUsersQueryDto,
  ): Promise<{
    data: User[];
    total: number;
    limit: number;
    orderBy: UserOrderBy;
    nextStart: string | null;
  }> {
    const limit = Math.min(100, Math.max(1, this.parsePositiveInt(dto.limit, 20)));
    const tenantId = this.normalizeTenantId(dto.tenantId);
    const orderBy = dto.orderBy ?? UserOrderBy.CREATED_AT;
    const ordering = USER_ORDERING[orderBy];
    const start = this.normalizeStart(dto.start, orderBy);

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.person', 'person')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .leftJoinAndSelect(
        'user.userRoles',
        'userRole',
        'userRole.deletedAt IS NULL',
      )
      .orderBy(ordering.column, ordering.direction)
      .distinct(true);

    if (ordering.column !== 'user.id') {
      qb.addOrderBy('user.id', ordering.direction);
    }

    if (tenantId !== undefined) {
      if (tenantId === null) {
        qb.andWhere('user.tenantId IS NULL');
      } else {
        qb.andWhere('user.tenantId = :tenantId', { tenantId });
      }
    }

    if (dto.name?.trim()) {
      qb.andWhere('LOWER(person.name) LIKE :personName', {
        personName: `%${dto.name.trim().toLowerCase()}%`,
      });
    }

    if (dto.role) {
      qb.innerJoin(
        'user.userRoles',
        'roleFilter',
        'roleFilter.deletedAt IS NULL AND roleFilter.role = :role',
        { role: dto.role },
      );
    }

    if (start !== undefined) {
      const operator = ordering.direction === 'ASC' ? '>' : '<';
      qb.andWhere(`${ordering.column} ${operator} :start`, { start });
    }

    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    const last = data[data.length - 1];

    return {
      data,
      total,
      limit,
      orderBy,
      nextStart: last ? ordering.readValue(last) : null,
    };
  }

  async findManagedUser(id: string, tenantId?: string | null): Promise<User> {
    const user = await this.findOne(id);

    if (tenantId && user.tenantId !== tenantId)
      throw new ForbiddenException('Acesso negado: usuário não pertence à empresa.');

    return user;
  }

  async updateManagedUser(
    id: string,
    dto: UpdateManagedUserDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
    tenantId?: string | null,
  ): Promise<User> {
    const user = await this.findOne(id);

    if (tenantId && user.tenantId !== tenantId) 
      throw new ForbiddenException('Acesso negado: usuário não pertence à empresa.');

    if (dto.email !== undefined || dto.document !== undefined) {
      await this.ensurePersonUniqueness(
        this.personRepo,
        dto.email !== undefined ? dto.email : (user.person.email ?? null),
        dto.document !== undefined
          ? dto.document
          : (user.person.document ?? null),
        user.personId,
      );
    }

    const person = user.person;
    if (dto.name !== undefined) {
      person.name = dto.name;
    }
    if (dto.email !== undefined) {
      person.email = dto.email;
    }
    if (dto.document !== undefined) {
      person.document = dto.document;
    }
    if (dto.fone !== undefined) {
      person.phone = dto.fone;
    }

    await this.personRepo.save(person);

    await this.auditLogService.logCriticalOperation({
      tenantId: user.tenantId,
      tableName: 'persons',
      operation: 'UPDATE',
      recordId: person.id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });

    await this.auditLogService.logCriticalOperation({
      tenantId: user.tenantId,
      tableName: 'users',
      operation: 'UPDATE',
      recordId: id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });

    return this.findManagedUser(id, tenantId);
  }

  async remove(
    id: string,
    actorUserId?: string | null,
    ipAddress?: string | null,
    tenantId?: string | null,
  ): Promise<void> {
    const user = await this.findManagedUser(id, tenantId);
    await this.userRepo.softRemove(user);
    await this.auditLogService.logCriticalOperation({
      tenantId: user.tenantId,
      tableName: 'users',
      operation: 'DELETE',
      recordId: id,
      userId: actorUserId ?? null,
      ipAddress: ipAddress ?? null,
    });
  }

  /**
   * Gera um token JWT de curta duração (30 min) para redefinição de senha.
   *
   * - org:admin pode gerar para qualquer usuário
   * - tenant:admin só pode gerar para usuários do seu próprio tenant
   */
  async generatePasswordResetToken(
    userId: string,
    actorTenantId: string | null,
  ): Promise<{ token: string; expiresInMinutes: number }> {
    const user = await this.findManagedUser(userId, actorTenantId);

    const secret = this.configService.get<string>('PASSWORD_RESET_SECRET')!;
    const token = jwt.sign(
      { sub: userId, purpose: 'password-reset' },
      secret,
      { expiresIn: '30m' },
    );
    await this.auditLogService.logCriticalOperation({
      tenantId: user.tenantId,
      tableName: 'users',
      operation: 'PASSWORD_RESET_TOKEN',
      recordId: userId,
      userId: null,
      ipAddress: null,
    });
    return { token, expiresInMinutes: 30 };
  }

  /**
   * Valida o token de reset e altera a senha (fluxo público, sem sessão ativa).
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string | null,
  ): Promise<void> {
    const usedTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const secret = this.configService.get<string>('PASSWORD_RESET_SECRET')!;

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException(
        'Token de redefinição inválido ou expirado.',
      );
    }

    if (payload['purpose'] !== 'password-reset' || !payload.sub) {
      throw new UnauthorizedException('Token inválido.');
    }

    const alreadyUsed = await this.auditLogService.isPasswordResetTokenAlreadyUsed(
      usedTokenHash,
    );
    if (alreadyUsed) {
      throw new UnauthorizedException('Token de redefinição já utilizado.');
    }

    const user = await this.findOne(payload.sub as string);

    await this.updatePassword(user.id, newPassword, {
      isSession: false,
      tenantId: user.tenantId,
      ipAddress: ipAddress,
      usedToken: usedTokenHash,
    });
  }

  private async ensurePersonUniqueness(
    repo: Repository<Person> | EntityManager,
    email?: string | null,
    document?: string | null,
    ignorePersonId?: string,
  ): Promise<void> {
    if (email) {
      const whereByEmail = ignorePersonId
        ? { email, id: Not(ignorePersonId) }
        : { email };
      const existingByEmail =
        repo instanceof EntityManager
          ? await repo.findOne(Person, { where: whereByEmail })
          : await repo.findOne({ where: whereByEmail });

      if (existingByEmail) {
        throw new ConflictException(`E-mail ${email} já está em uso.`);
      }
    }

    if (document) {
      const whereByDocument = ignorePersonId
        ? { document, id: Not(ignorePersonId) }
        : { document };
      const existingByDocument =
        repo instanceof EntityManager
          ? await repo.findOne(Person, { where: whereByDocument })
          : await repo.findOne({ where: whereByDocument });

      if (existingByDocument) {
        throw new ConflictException(`Documento ${document} já está em uso.`);
      }
    }
  }

  private normalizeTenantId(
    tenantId?: string,
  ): string | null | undefined {
    if (tenantId === undefined) {
      return undefined;
    }

    return tenantId === 'null' ? null : tenantId;
  }

  private normalizeStart(
    start: string | undefined,
    orderBy: UserOrderBy,
  ): string | Date | undefined {
    if (!start) {
      return undefined;
    }

    if (
      orderBy === UserOrderBy.CREATED_AT ||
      orderBy === UserOrderBy.UPDATED_AT
    ) {
      const parsed = new Date(start);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          `Valor inválido para cursor ${orderBy}: ${start}`,
        );
      }

      return parsed;
    }

    return start;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }

    return Math.max(1, parsed);
  }

  private async updatePassword(
    userId: string,
    newPassword: string,
    opts: {
      isSession: boolean;
      tenantId?: string | null;
      ipAddress?: string | null;
      usedToken?: string | null;
    },
  ): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { passwordHash: hash });
    await this.auditLogService.logPasswordChange({
      tenantId: opts.tenantId ?? null,
      userId,
      isSession: opts.isSession,
      ipAddress: opts.ipAddress ?? null,
      usedToken: opts.usedToken ?? null,
    });
  }
}
