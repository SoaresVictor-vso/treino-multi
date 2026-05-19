import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { AuthenticationLog } from './entities/authentication-log.entity';
import { CriticalOperationLog, CriticalOperation } from './entities/critical-operation-log.entity';
import { PasswordChangeLog } from './entities/password-change-log.entity';

// ── DTOs internos (não expostos via HTTP) ─────────────────────────────────────

export interface LogAuthenticationDto {
  /** null quando context = 'organization' */
  tenantId: string | null;
  /** Contexto do usuário que tentou autenticar */
  context: 'organization' | 'tenant' | 'standalone';
  success: boolean;
  /** Identificador utilizado (e-mail ou CPF) — nunca armazenar senha */
  loginUsed: string;
  ipAddress?: string | null;
}

export interface LogCriticalOperationDto {
  /** null quando context = 'organization' */
  tenantId: string | null;
  tableName: string;
  operation: CriticalOperation;
  recordId: string;
  /** null em operações automáticas do sistema (bootstrap) */
  userId: string | null;
  ipAddress?: string | null;
  /**
   * Snapshot das alterações de campos críticos.
   * Formato: { field: { before: any, after: any } }
   * Informar em UPDATE; omitir em CREATE/DELETE/READ.
   */
  diff?: Record<string, { before: unknown; after: unknown }> | null;
}

export interface LogPasswordChangeDto {
  /** null quando context = 'organization' */
  tenantId: string | null;
  userId: string;
  /**
   * true  = troca com sessão ativa (usuário autenticado)
   * false = fluxo de recuperação de senha
   */
  isSession: boolean;
  ipAddress?: string | null;
  usedToken?: string | null;
}

// ── Filtros de consulta ────────────────────────────────────────────────────────

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

/** Mapa de contexto para contextTypeId da tabela log_context_types */
const CONTEXT_TYPE_ID: Record<string, number> = {
  organization: 1,
  tenant: 2,
  standalone: 3,
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuthenticationLog)
    private readonly authLogRepo: Repository<AuthenticationLog>,
    @InjectRepository(CriticalOperationLog)
    private readonly criticalLogRepo: Repository<CriticalOperationLog>,
    @InjectRepository(PasswordChangeLog)
    private readonly passwordLogRepo: Repository<PasswordChangeLog>,
  ) {}

  // ── Gravação ─────────────────────────────────────────────────────────────────

  async logAuthentication(dto: LogAuthenticationDto): Promise<void> {
    const log = this.authLogRepo.create({
      tenantId: dto.tenantId,
      contextTypeId: CONTEXT_TYPE_ID[dto.context] ?? 3,
      success: dto.success,
      loginUsed: dto.loginUsed,
      ipAddress: dto.ipAddress ?? null,
    });
    await this.authLogRepo.save(log);
  }

  async logCriticalOperation(dto: LogCriticalOperationDto): Promise<void> {
    const log = this.criticalLogRepo.create({
      tenantId: dto.tenantId,
      tableName: dto.tableName,
      operation: dto.operation,
      recordId: dto.recordId,
      userId: dto.userId,
      ipAddress: dto.ipAddress ?? null,
      diff: dto.diff ?? null,
    });
    await this.criticalLogRepo.save(log);
  }

  async logPasswordChange(dto: LogPasswordChangeDto): Promise<void> {
    const log = this.passwordLogRepo.create({
      tenantId: dto.tenantId,
      userId: dto.userId,
      isSession: dto.isSession,
      ipAddress: dto.ipAddress ?? null,
      usedToken: dto.usedToken ?? null,
    });
    await this.passwordLogRepo.save(log);
  }

  async isPasswordResetTokenAlreadyUsed(usedToken: string): Promise<boolean> {
    const existing = await this.passwordLogRepo.findOne({
      where: {
        isSession: false,
        usedToken,
      },
      select: { id: true },
    });

    return !!existing;
  }

  // ── Consulta paginada ─────────────────────────────────────────────────────────

  async findAuthenticationLogs(
    filter: AuditLogFilter,
  ): Promise<{ data: AuthenticationLog[]; total: number }> {
    const qb = this.authLogRepo.createQueryBuilder('al');

    if (filter.tenantId) {
      qb.andWhere('al.tenant_id = :tenantId', { tenantId: filter.tenantId });
    }
    if (filter.from) {
      qb.andWhere('al.created_at >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('al.created_at <= :to', { to: filter.to });
    }

    qb.orderBy('al.created_at', 'DESC');
    this.applyPagination(qb, filter);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findCriticalOperationLogs(
    filter: AuditLogFilter,
  ): Promise<{ data: CriticalOperationLog[]; total: number }> {
    const qb = this.criticalLogRepo.createQueryBuilder('col');

    if (filter.tenantId) {
      qb.andWhere('col.tenant_id = :tenantId', { tenantId: filter.tenantId });
    }
    if (filter.userId) {
      qb.andWhere('col.user_id = :userId', { userId: filter.userId });
    }
    if (filter.from) {
      qb.andWhere('col.created_at >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('col.created_at <= :to', { to: filter.to });
    }

    qb.orderBy('col.created_at', 'DESC');
    this.applyPagination(qb, filter);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findPasswordChangeLogs(
    filter: AuditLogFilter,
  ): Promise<{ data: PasswordChangeLog[]; total: number }> {
    const qb = this.passwordLogRepo.createQueryBuilder('pcl');

    if (filter.tenantId) {
      qb.andWhere('pcl.tenant_id = :tenantId', { tenantId: filter.tenantId });
    }
    if (filter.userId) {
      qb.andWhere('pcl.user_id = :userId', { userId: filter.userId });
    }
    if (filter.from) {
      qb.andWhere('pcl.created_at >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('pcl.created_at <= :to', { to: filter.to });
    }

    qb.orderBy('pcl.created_at', 'DESC');
    this.applyPagination(qb, filter);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ── helpers ───────────────────────────────────────────────────────────────────

  private applyPagination(
    qb: ReturnType<Repository<any>['createQueryBuilder']>,
    filter: AuditLogFilter,
  ): void {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    qb.skip((page - 1) * limit).take(limit);
  }
}
