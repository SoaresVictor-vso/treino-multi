import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import { AuditLogService } from '../audit-logs/audit-logs.service';

/** Roles permitidas por contexto de usuário */
const ROLES_BY_CONTEXT: Record<string, Role[]> = {
  organization: [Role.ORG_ADMIN, Role.ORG_SUPPORT],
  tenant: [Role.TENANT_ADMIN],
  standalone: [Role.STANDALONE_USER],
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Garante que:
   *  - context='tenant' → tenantId obrigatório
   *  - context='organization'|'standalone' → tenantId deve ser omitido
   *  - roles fornecidas são compatíveis com o contexto
   */
  private validateContextAndRoles(
    context: string,
    tenantId: string | null | undefined,
    roles: Role[],
  ): void {
    if (context === 'tenant' && !tenantId) {
      throw new BadRequestException(
        "context 'tenant' exige tenantId preenchido.",
      );
    }
    if (context !== 'tenant' && tenantId) {
      throw new BadRequestException(
        `context '${context}' não pode ter tenantId.`,
      );
    }

    const allowed = ROLES_BY_CONTEXT[context] ?? [];
    const invalid = roles.filter((r) => !allowed.includes(r));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Roles inválidas para contexto '${context}': ${invalid.join(', ')}`,
      );
    }
  }

  async create(
    dto: CreateUserDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<User> {
    this.validateContextAndRoles(dto.context, dto.tenantId, dto.roles);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.dataSource.transaction(async (em) => {
      const user = em.create(User, {
        personId: dto.personId,
        tenantId: dto.tenantId ?? null,
        context: dto.context,
        passwordHash,
        isActive: true,
      });
      const saved = await em.save(User, user);

      const roleEntities = dto.roles.map((r) =>
        em.create(UserRole, { userId: saved.id, role: r }),
      );
      await em.save(UserRole, roleEntities);

      const result = await em.findOneOrFail(User, {
        where: { id: saved.id },
        relations: ['userRoles', 'person'],
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

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: ['person', 'userRoles'],
      order: { createdAt: 'DESC' },
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

  /**
   * Altera a senha do usuário e gera log de password-change.
   *
   * @param isSession  true = troca com sessão ativa; false = fluxo de reset
   */
  async changePassword(
    userId: string,
    newPassword: string,
    opts: {
      isSession: boolean;
      tenantId?: string | null;
      actorUserId?: string | null;
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

  async update(
    id: string,
    dto: UpdateUserDto,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<User> {
    const user = await this.findOne(id);

    // Se apenas a senha mudou, registra password-change e retorna sem log crítico
    const onlyPasswordChange =
      dto.password !== undefined &&
      dto.isActive === undefined &&
      dto.roles === undefined;

    if (dto.password !== undefined) {
      await this.changePassword(id, dto.password, {
        isSession: true,
        tenantId: user.tenantId,
        actorUserId: actorUserId ?? null,
        ipAddress: ipAddress,
      });
    }

    if (onlyPasswordChange) {
      return this.findOne(id);
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    return this.dataSource.transaction(async (em) => {
      await em.save(User, user);

      if (dto.roles !== undefined) {
        // Revoga roles existentes via soft delete
        await em.softDelete(UserRole, { userId: id });

        // Insere novas roles
        const roleEntities = dto.roles.map((r) =>
          em.create(UserRole, { userId: id, role: r }),
        );
        await em.save(UserRole, roleEntities);
      }

      const result = await em.findOneOrFail(User, {
        where: { id },
        relations: ['userRoles', 'person', 'tenant'],
      });

      await this.auditLogService.logCriticalOperation({
        tenantId: result.tenantId,
        tableName: 'users',
        operation: 'UPDATE',
        recordId: id,
        userId: actorUserId ?? null,
        ipAddress: ipAddress ?? null,
      });

      return result;
    });
  }

  async remove(
    id: string,
    actorUserId?: string | null,
    ipAddress?: string | null,
  ): Promise<void> {
    const user = await this.findOne(id);
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
    const user = await this.findOne(userId);

    if (actorTenantId && user.tenantId !== actorTenantId) {
      throw new ForbiddenException(
        'Acesso negado: usuário pertence a outro tenant.',
      );
    }

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

    await this.changePassword(user.id, newPassword, {
      isSession: false,
      tenantId: user.tenantId,
      actorUserId: null,
      ipAddress: ipAddress,
      usedToken: usedTokenHash,
    });
  }
}
