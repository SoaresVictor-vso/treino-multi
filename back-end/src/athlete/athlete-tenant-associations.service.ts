import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { ATHLETE_HISTORY_NAME_TTL_MS, ATHLETE_INVITE_TTL_MS } from '../common/constants/athlete-association.constants';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { User } from '../users/entities/user.entity';
import { Person } from '../persons/entities/person.entity';
import { AthleteTrainerAssociation } from './entities/athlete-trainer-association.entity';
import { AthleteTenantAssociation } from './entities/athlete-tenant-association.entity';
import { AthleteTenantStatus } from '../common/enums/athlete-tenant-status.enum';
import { AthleteReadScope } from '../common/enums/athlete-read-scope.enum';

@Injectable()
export class AthleteTenantAssociationsService {
  constructor(private readonly db: DataSource) {}

  private async operator(actor: JwtPayload, password?: string) {
    if (!actor.tenantId || !actor.roles.some(r => r === Role.TENANT_ADMIN || r === Role.TENANT_TRAINER_MASTER))
      throw new ForbiddenException('É necessário ser administrador ou treinador master do tenant.');
    const user = await this.db.getRepository(User).findOne({ where: { id: actor.sub, tenantId: actor.tenantId, isActive: true }, relations: ['userRoles'] });
    if (!user || !user.userRoles.some(r => !r.deletedAt && (r.role === Role.TENANT_ADMIN || r.role === Role.TENANT_TRAINER_MASTER)))
      throw new ForbiddenException('Operador sem vínculo ativo com este tenant.');
    if (password !== undefined && (!user.passwordHash || !await bcrypt.compare(password, user.passwordHash)))
      throw new UnauthorizedException('Senha de confirmação inválida.');
    return user;
  }

  private async expirePending(manager: DataSource['manager'], athleteId: string, tenantId: string) {
    await manager.createQueryBuilder().update(AthleteTenantAssociation)
      .set({ status: AthleteTenantStatus.EXPIRED })
      .where('athlete_id = :athleteId AND tenant_id = :tenantId AND status = :pending AND expires_at <= now()',
        { athleteId, tenantId, pending: AthleteTenantStatus.PENDING }).execute();
  }

  private async beginInviteAudit(actor: JwtPayload, email: string, ipAddress?: string): Promise<string> {
    const emailHmac = crypto.createHmac('sha256', process.env.INVITE_AUDIT_HMAC_KEY ?? process.env.JWT_SECRET ?? '')
      .update(email).digest('hex');
    const audit = await this.db.transaction(async manager => {
      // Serialize checks for a tenant so parallel requests cannot bypass its quota.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [`athlete-invite:${actor.tenantId}`]);
      const [counts] = await manager.query<{
        actor: string; tenant: string; origin: string; blocked: string; last_blocked: Date | null;
      }[]>(`
        SELECT count(*) FILTER (WHERE operator_id=$1 AND created_at > now() - interval '1 hour') AS actor,
          count(*) FILTER (WHERE tenant_id=$2 AND created_at > now() - interval '1 hour') AS tenant,
          count(*) FILTER (WHERE origin_ip=$3 AND $3 IS NOT NULL AND created_at > now() - interval '1 hour') AS origin,
          count(*) FILTER (WHERE result='rate-limited' AND operator_id=$1 AND created_at > now() - interval '1 day') AS blocked,
          max(created_at) FILTER (WHERE result='rate-limited' AND operator_id=$1) AS last_blocked
        FROM athlete_invite_attempts WHERE created_at > now() - interval '1 day'`,
        [actor.sub, actor.tenantId, ipAddress ?? null]);
      const blockCount = Number(counts?.blocked ?? 0);
      const blockMinutes = blockCount >= 8 ? 24 * 60 : blockCount >= 4 ? 4 * 60 : blockCount >= 2 ? 60 : 15;
      const stillBlocked = blockCount > 0 && counts?.last_blocked &&
        Date.now() - new Date(counts.last_blocked).getTime() < blockMinutes * 60_000;
      const exceeded = !!stillBlocked || Number(counts?.actor ?? 0) >= 20 ||
        Number(counts?.tenant ?? 0) >= 100 || Number(counts?.origin ?? 0) >= 40;
      const [attempt] = await manager.query<{ id: string }[]>(`
        INSERT INTO athlete_invite_attempts(operator_id,tenant_id,origin_ip,email_hmac,result)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [actor.sub, actor.tenantId, ipAddress ?? null, emailHmac, exceeded ? 'rate-limited' : 'started']);
      return { id: attempt.id, exceeded };
    });
    if (audit.exceeded) throw new HttpException('Limite de convites atingido. Tente novamente mais tarde.', 429);
    return audit.id;
  }

  async invite(actor: JwtPayload, email: string, password: string, ipAddress?: string) {
    await this.operator(actor, password); // permission and tenant validation precede email lookup
    const normalized = email.trim().toLowerCase();
    const auditId = await this.beginInviteAudit(actor, normalized, ipAddress);
    let outcome = 'created';
    try {
    return await this.db.transaction(async manager => {
      const person = await manager.getRepository(Person).createQueryBuilder('p')
        .where('lower(btrim(p.email)) = :email', { email: normalized }).getOne();
      const athlete = person && await manager.getRepository(User).createQueryBuilder('u')
        .innerJoin('u.userRoles', 'role', 'role.role = :role AND role.deleted_at IS NULL', { role: Role.TENANT_CLIENT })
        .where('u.person_id = :personId AND u.is_active = true AND u.deleted_at IS NULL', { personId: person.id }).getOne();
      if (!athlete) { outcome = 'athlete-not-found'; throw new NotFoundException('Atleta não encontrado.'); }
      await this.expirePending(manager, athlete.id, actor.tenantId!);
      const current = await manager.findOne(AthleteTenantAssociation, {
        where: [{ athleteId: athlete.id, tenantId: actor.tenantId!, status: AthleteTenantStatus.PENDING },
          { athleteId: athlete.id, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE }],
      });
      if (current?.status === AthleteTenantStatus.ACTIVE) { outcome = 'active'; throw new ConflictException('Vínculo já ativo.'); }
      if (current) { outcome = 'pending'; throw new ConflictException('Convite pendente ainda válido.'); }
      const now = new Date();
      const episode = await manager.save(AthleteTenantAssociation, manager.create(AthleteTenantAssociation, {
        athleteId: athlete.id, tenantId: actor.tenantId!, invitedEmail: normalized, status: AthleteTenantStatus.PENDING,
        scope: AthleteReadScope.PRESCRIBED_BY_TENANT, invitedAt: now,
        expiresAt: new Date(now.getTime() + ATHLETE_INVITE_TTL_MS), invitedByUserId: actor.sub,
      }));
      await manager.save(CriticalOperationLog, manager.create(CriticalOperationLog, {
        tenantId: episode.tenantId, tableName: 'athlete_tenant_associations', operation: 'CREATE',
        recordId: episode.id, userId: actor.sub, ipAddress: ipAddress ?? null, diff: null,
      }));
      return { id: episode.id, status: episode.status, invitedAt: episode.invitedAt, expiresAt: episode.expiresAt };
    });
    } catch (error) { if (outcome === 'created') outcome = 'error'; throw error; }
    finally { await this.db.query('UPDATE athlete_invite_attempts SET result=$1 WHERE id=$2', [outcome, auditId]); }
  }

  async decide(actor: JwtPayload, id: string, accept: boolean, ipAddress?: string) {
    await this.db.getRepository(AthleteTenantAssociation).createQueryBuilder().update()
      .set({ status: AthleteTenantStatus.EXPIRED })
      .where('id = :id AND athlete_id = :athleteId AND status = :pending AND expires_at <= now()',
        { id, athleteId: actor.sub, pending: AthleteTenantStatus.PENDING }).execute();
    return this.db.transaction(async manager => {
      const episode = await manager.findOne(AthleteTenantAssociation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!episode || episode.athleteId !== actor.sub) throw new NotFoundException('Convite não encontrado.');
      if (episode.status !== AthleteTenantStatus.PENDING) throw new ConflictException('Convite já decidido.');
      if (episode.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Convite expirado.');
      const now = new Date();
      episode.status = accept ? AthleteTenantStatus.ACTIVE : AthleteTenantStatus.REJECTED;
      if (accept) { episode.acceptedAt = now; episode.startedAt = now; episode.acceptedByUserId = actor.sub; }
      await manager.save(episode);
      await manager.save(CriticalOperationLog, manager.create(CriticalOperationLog, {
        tenantId: episode.tenantId, tableName: 'athlete_tenant_associations', operation: 'UPDATE',
        recordId: episode.id, userId: actor.sub, ipAddress: ipAddress ?? null,
        diff: { status: { before: 'pending', after: episode.status },
          ...(accept ? { acceptedAt: { before: null, after: now }, startedAt: { before: null, after: now } } : {}) },
      }));
      return { id, status: episode.status };
    });
  }

  async revoke(actor: JwtPayload, id: string, ipAddress?: string) {
    await this.operator(actor);
    return this.db.transaction(async manager => {
      const episode = await manager.findOne(AthleteTenantAssociation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!episode || episode.tenantId !== actor.tenantId || episode.invitedByUserId !== actor.sub)
        throw new NotFoundException('Convite não encontrado.');
      if (episode.status !== AthleteTenantStatus.PENDING || episode.expiresAt.getTime() <= Date.now())
        throw new ConflictException('Convite não está mais pendente.');
      episode.status = AthleteTenantStatus.REVOKED;
      await manager.save(episode);
      await manager.save(CriticalOperationLog, manager.create(CriticalOperationLog, {
        tenantId: episode.tenantId, tableName: 'athlete_tenant_associations', operation: 'UPDATE',
        recordId: episode.id, userId: actor.sub, ipAddress: ipAddress ?? null,
        diff: { status: { before: 'pending', after: 'revoked' } },
      }));
      return { id, status: episode.status };
    });
  }

  async end(actor: JwtPayload, id: string, password?: string, ipAddress?: string) {
    // An athlete can end their own episode without a password. Operators require one.
    if (password !== undefined) await this.operator(actor, password);
    return this.db.transaction(async manager => {
      const episode = await manager.findOne(AthleteTenantAssociation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!episode) throw new NotFoundException('Vínculo não encontrado.');
      if (episode.athleteId !== actor.sub) {
        if (!password || episode.tenantId !== actor.tenantId) throw new ForbiddenException('Acesso negado.');
        await this.operator(actor, password);
      }
      if (episode.status !== AthleteTenantStatus.ACTIVE) throw new ConflictException('Vínculo não está ativo.');
      const now = new Date();
      episode.status = AthleteTenantStatus.CANCELLED;
      episode.endedAt = now;
      episode.endedByUserId = actor.sub;
      await manager.save(episode);
      await manager.createQueryBuilder().update(AthleteTrainerAssociation)
        .set({ endDate: now.toISOString().slice(0, 10), endedByUserId: actor.sub })
        .where('athlete_tenant_association_id = :id AND data_fim IS NULL', { id }).execute();
      await manager.save(CriticalOperationLog, manager.create(CriticalOperationLog, {
        tenantId: episode.tenantId, tableName: 'athlete_tenant_associations', operation: 'UPDATE',
        recordId: episode.id, userId: actor.sub, ipAddress: ipAddress ?? null,
        diff: { status: { before: 'active', after: 'cancelled' }, endedAt: { before: null, after: now },
          endedByUserId: { before: null, after: actor.sub } },
      }));
      return { id, status: episode.status, endedAt: now };
    });
  }

  async changeScope(actor: JwtPayload, id: string, scope: AthleteReadScope, ipAddress?: string) {
    return this.db.transaction(async manager => {
      const episode = await manager.findOne(AthleteTenantAssociation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!episode || episode.athleteId !== actor.sub) throw new NotFoundException('Vínculo não encontrado.');
      if (episode.status !== AthleteTenantStatus.ACTIVE) throw new ConflictException('Vínculo não está ativo.');
      if (!Object.values(AthleteReadScope).includes(scope)) throw new BadRequestException('Escopo inválido.');
      if (scope === AthleteReadScope.PRESCRIBED_BY_TENANT_LIFETIME && !await manager.exists(AthleteTenantAssociation, {
        where: { athleteId: actor.sub, tenantId: episode.tenantId, status: AthleteTenantStatus.CANCELLED },
      })) throw new BadRequestException('Escopo disponível apenas após recontratação.');
      const before = episode.scope;
      if (before === scope) return { id, scope };
      episode.scope = scope;
      await manager.save(episode);
      await manager.save(CriticalOperationLog, manager.create(CriticalOperationLog, {
        tenantId: episode.tenantId, tableName: 'athlete_tenant_associations', operation: 'UPDATE',
        recordId: episode.id, userId: actor.sub, ipAddress: ipAddress ?? null,
        diff: { scope: { before, after: scope } },
      }));
      return { id, scope };
    });
  }

  async mine(actor: JwtPayload) {
    const repo = this.db.getRepository(AthleteTenantAssociation);
    await repo.createQueryBuilder().update().set({ status: AthleteTenantStatus.EXPIRED })
      .where('athlete_id = :id AND status = :pending AND expires_at <= now()', { id: actor.sub, pending: AthleteTenantStatus.PENDING }).execute();
    const episodes = await repo.find({ where: { athleteId: actor.sub }, relations: ['tenant'], order: { invitedAt: 'DESC', createdAt: 'DESC' } });
    const trainers = episodes.length ? await this.db.getRepository(AthleteTrainerAssociation).find({
      where: { athleteTenantAssociationId: In(episodes.map(e => e.id)) }, relations: ['trainer', 'trainer.person'],
    }) : [];
    return episodes.filter(e => e.status !== AthleteTenantStatus.EXPIRED && e.status !== AthleteTenantStatus.REVOKED).map(e => ({
      id: e.id, tenantName: e.tenant.name, status: e.status, scope: e.scope, invitedAt: e.invitedAt,
      expiresAt: e.expiresAt, startedAt: e.startedAt, endedAt: e.endedAt,
      previousContract: episodes.some(previous => previous.tenantId === e.tenantId &&
        previous.status === AthleteTenantStatus.CANCELLED && previous.invitedAt < e.invitedAt),
      trainers: trainers.filter(t => t.athleteTenantAssociationId === e.id).map(t => ({
        name: t.trainer.person.name, startDate: t.startDate, endDate: t.endDate,
      })),
    }));
  }

  async tenantActive(actor: JwtPayload) {
    await this.operator(actor);
    const episodes = await this.db.getRepository(AthleteTenantAssociation).find({
      where: { tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE },
      relations: ['athlete', 'athlete.person'], order: { startedAt: 'DESC' },
    });
    return episodes.map(e => ({ id: e.id, athleteName: e.athlete.person.name, startedAt: e.startedAt }));
  }

  async tenantHistory(actor: JwtPayload) {
    await this.operator(actor);
    const episodes = await this.db.getRepository(AthleteTenantAssociation).find({
      where: { tenantId: actor.tenantId! }, relations: ['athlete', 'athlete.person'], order: { invitedAt: 'DESC' },
    });
    const logs = episodes.length ? await this.db.getRepository(CriticalOperationLog).find({
      where: { tenantId: actor.tenantId!, tableName: 'athlete_tenant_associations',
        recordId: In(episodes.map(e => e.id)) }, order: { createdAt: 'ASC' },
    }) : [];
    const now = Date.now();
    return episodes.map(e => {
      const named = e.status === AthleteTenantStatus.ACTIVE ||
        (e.status === AthleteTenantStatus.CANCELLED && !!e.endedAt && now - e.endedAt.getTime() < ATHLETE_HISTORY_NAME_TTL_MS);
      return { ...(e.status === AthleteTenantStatus.PENDING && e.invitedByUserId === actor.sub ? { id: e.id } : {}),
        status: e.status, scope: e.scope, invitedAt: e.invitedAt, startedAt: e.startedAt, endedAt: e.endedAt,
        invitedEmail: [AthleteTenantStatus.PENDING, AthleteTenantStatus.REJECTED, AthleteTenantStatus.EXPIRED, AthleteTenantStatus.REVOKED].includes(e.status) ? e.invitedEmail : null,
        athleteName: named ? e.athlete.person.name :
          e.status === AthleteTenantStatus.CANCELLED ? 'Atleta desligado' :
          e.status === AthleteTenantStatus.PENDING ? 'Convite pendente' :
          e.status === AthleteTenantStatus.REJECTED ? 'Convite recusado' :
          e.status === AthleteTenantStatus.REVOKED ? 'Convite revogado' : 'Convite expirado',
        events: logs.filter(log => log.recordId === e.id).map(log => ({
          type: log.operation === 'CREATE' ? 'invite' : log.diff?.status?.after ?? 'scope',
          at: log.createdAt, actorRole: log.userId === e.athleteId ? 'atleta' : 'consultoria',
        })) };
    });
  }
}
