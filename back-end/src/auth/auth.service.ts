import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Valida login (e-mail ou document) + senha sem considerar contexto.
   * Retorna o User (com UserRoles carregadas) ou null se as credenciais
   * forem inválidas ou o usuário estiver inativo / deletado.
   */
  async validateUser(
    login: string,
    password: string,
  ): Promise<User | null> {
    // Tenta localizar a person pelo e-mail; se não encontrar, tenta pelo document
    let person = await this.personRepo.findOne({ where: { email: login } });
    if (!person) {
      person = await this.personRepo.findOne({ where: { document: login } });
    }
    if (!person) return null;

    const user = await this.userRepo.findOne({
      where: { personId: person.id, isActive: true },
      relations: ['userRoles'],
    });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  /**
   * Executa o login completo:
   * 1. Valida credenciais
   * 2. Resolve o contexto correto (org / tenant / standalone) a partir de tenantSlug
   * 3. Gera accessToken (JWT curta duração) e refreshToken (longa duração)
   * 4. Armazena o hash do refreshToken na tabela refresh_tokens
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const user = await this.validateUser(dto.login, dto.password);

    // Resolve o contexto para o log antes de lançar exceção
    const loginContext = user?.context ?? 'standalone';
    const loginTenantId = user?.tenantId ?? null;

    // Registra tentativa de login (sucesso ou falha)
    await this.auditLogService.logAuthentication({
      tenantId: loginTenantId,
      context: loginContext as 'organization' | 'tenant' | 'standalone',
      success: !!user,
      loginUsed: dto.login,
      ipAddress: ipAddress ?? null,
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const roles = (user.userRoles ?? [])
      .filter((ur) => !ur.deletedAt)
      .map((ur) => ur.role as Role);

    const payload: JwtPayload = {
      sub: user.id,
      personId: user.personId,
      context: user.context,
      tenantId: user.tenantId,
      roles,
      impersonatedBy: null,
    };

    const accessToken = this.jwtService.sign(payload);
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(expiresIn));

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      }),
    );

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * Valida o refreshToken recebido:
   * 1. Calcula o hash SHA-256 do token bruto
   * 2. Procura no banco pelo hash + não revogado + não expirado
   * 3. Emite novo accessToken (sem rotação do refreshToken nesta fase)
   */
  async refreshAccessToken(rawToken: string): Promise<{ accessToken: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user', 'user.userRoles'],
    });

    if (!stored) throw new UnauthorizedException('Refresh token inválido');
    if (stored.revokedAt) throw new UnauthorizedException('Refresh token revogado');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expirado');

    const { user } = stored;
    const roles = (user.userRoles ?? [])
      .filter((ur) => !ur.deletedAt)
      .map((ur) => ur.role as Role);

    const payload: JwtPayload = {
      sub: user.id,
      personId: user.personId,
      context: user.context,
      tenantId: user.tenantId,
      roles,
      impersonatedBy: null,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  /**
   * Revoga o refreshToken (seta revokedAt = now()).
   * Idempotente — não lança erro se o token já foi revogado.
   */
  async logout(rawToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });
    if (!stored) throw new NotFoundException('Refresh token não encontrado');

    if (!stored.revokedAt) {
      await this.refreshTokenRepo.update(stored.id, { revokedAt: new Date() });
    }
  }

  /**
   * Gera um token de impersonation para org:support.
   * O payload JWT é idêntico ao de um login normal do targetUser,
   * mas com impersonatedBy = actorUserId.
   */
  async impersonate(
    actorUserId: string,
    tenantId: string,
    targetUserId?: string,
  ): Promise<{ accessToken: string }> {
    let targetUser: User | null = null;

    if (targetUserId) {
      targetUser = await this.userRepo.findOne({
        where: { id: targetUserId, tenantId, isActive: true },
        relations: ['userRoles'],
      });
      if (!targetUser) throw new NotFoundException('Usuário alvo não encontrado');
    } else {
      // Busca qualquer tenant:admin ativo no tenant
      targetUser = await this.userRepo
        .createQueryBuilder('u')
        .innerJoin('u.userRoles', 'ur')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('u.is_active = true')
        .andWhere('ur.role = :role', { role: 'tenant:admin' })
        .andWhere('ur.deleted_at IS NULL')
        .getOne();

      if (!targetUser) throw new NotFoundException('Nenhum tenant:admin ativo encontrado');
    }

    const roles = (targetUser.userRoles ?? [])
      .filter((ur) => !ur.deletedAt)
      .map((ur) => ur.role as Role);

    const payload: JwtPayload = {
      sub: targetUser.id,
      personId: targetUser.personId,
      context: targetUser.context,
      tenantId: targetUser.tenantId,
      roles,
      impersonatedBy: actorUserId,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * Delega a redefinição de senha ao UsersService (fluxo público).
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string | null,
  ): Promise<void> {
    return this.usersService.resetPassword(token, newPassword, ipAddress ?? null);
  }

  private parseDuration(duration: string): number {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * (MS[unit] ?? 1000);
  }
}
