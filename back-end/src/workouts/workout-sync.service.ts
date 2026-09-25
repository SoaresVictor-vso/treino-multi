import { randomUUID } from 'node:crypto';
import { enums } from '@treino-multi/shared';
import {
  BadRequestException, ConflictException, ForbiddenException,
  GoneException, Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { SyncWorkoutDto } from './dto/sync-workout.dto';
import { WorkoutsService } from './workouts.service';

const { Role, WorkoutStatus, ExecutionStatus } = enums;
export const SYNC_CURSOR_RETENTION_DAYS = 30;
const SCOPE = 'workouts';

type Cursor = { userId: string; scope: typeof SCOPE; revision: number };
type ScopeRow = { revision: string; min_cursor: string };

function decodeCursor(value: string, userId: string): number {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (cursor.userId !== userId || cursor.scope !== SCOPE ||
        !Number.isSafeInteger(cursor.revision) || cursor.revision < 0)
      throw new Error('Invalid cursor');
    return cursor.revision;
  } catch {
    throw new BadRequestException('Cursor de sincronização inválido.');
  }
}

function encodeCursor(userId: string, revision: number): string {
  return Buffer.from(JSON.stringify({ userId, scope: SCOPE, revision })).toString('base64url');
}

@Injectable()
export class WorkoutSyncService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workouts: WorkoutsService,
  ) {}

  private requireAthlete(actor: JwtPayload) {
    if (!actor.roles.includes(Role.TENANT_CLIENT))
      throw new ForbiddenException('A sincronização de treinos é exclusiva do próprio atleta.');
  }

  async pull(actor: JwtPayload, cursorValue?: string) {
    this.requireAthlete(actor);
    // The cleanup advances the oldest valid cursor in the same statement that
    // removes history. Operations are retained for idempotent retries.
    await this.dataSource.query(`
      WITH removed AS (
        DELETE FROM workout_sync_history
        WHERE created_at < now() - ($1::integer * interval '1 day')
        RETURNING user_id, scope, revision
      ), limits AS (
        SELECT user_id, scope, max(revision) AS last_removed
        FROM removed GROUP BY user_id, scope
      )
      UPDATE workout_sync_scopes state
      SET min_cursor = GREATEST(state.min_cursor, limits.last_removed)
      FROM limits WHERE state.user_id = limits.user_id AND state.scope = limits.scope
    `, [SYNC_CURSOR_RETENTION_DAYS]);
    const [scope] = await this.dataSource.query<ScopeRow[]>(
      'SELECT revision, min_cursor FROM workout_sync_scopes WHERE user_id = $1 AND scope = $2',
      [actor.sub, SCOPE],
    );
    const revision = Number(scope?.revision ?? 0);
    const minCursor = Number(scope?.min_cursor ?? 0);
    const cursor = cursorValue ? decodeCursor(cursorValue, actor.sub) : null;
    if (cursor !== null && cursor < minCursor)
      throw new GoneException({ code: 'SYNC_CURSOR_EXPIRED', message: 'Cursor expirado. Faça uma sincronização completa.' });
    if (cursor !== null && cursor > revision)
      throw new BadRequestException('Cursor de sincronização futuro.');
    const full = cursor === null;
    const ids = full
      ? await this.dataSource.query<{ id: string }[]>(
          'SELECT id FROM workouts WHERE athlete_id = $1 ORDER BY created_at, id', [actor.sub],
        )
      : await this.dataSource.query<{ id: string }[]>(`
          SELECT DISTINCT workout_id AS id FROM workout_sync_history
          WHERE user_id = $1 AND scope = $2 AND revision > $3 AND revision <= $4
          ORDER BY id
        `, [actor.sub, SCOPE, cursor, revision]);
    const workouts: unknown[] = [];
    const deletedIds: string[] = [];
    for (const { id } of ids) {
      const [exists] = await this.dataSource.query<{ id: string }[]>(
        'SELECT id FROM workouts WHERE id = $1 AND athlete_id = $2', [id, actor.sub],
      );
      if (exists) workouts.push(await this.findVersionedWorkout(id, actor));
      else deletedIds.push(id);
    }
    return { full, workouts, deletedIds, cursor: encodeCursor(actor.sub, revision) };
  }

  async findVersionedWorkout(id: string, actor: JwtPayload) {
    const workout = await this.workouts.findWorkout(id, actor);
    const [version] = await this.dataSource.query<{ revision: string }[]>(
      'SELECT revision FROM workout_sync_versions WHERE workout_id = $1', [id],
    );
    return { ...workout, syncRevision: Number(version?.revision ?? 0) };
  }

  async apply(dto: SyncWorkoutDto, actor: JwtPayload) {
    this.requireAthlete(actor);
    if (!['force', 'copy', undefined].includes(dto.resolution))
      throw new BadRequestException('Resolução de conflito inválida.');
    if (!dto.templateName?.trim()) throw new BadRequestException('Informe o nome do treino.');
    if (new Set(dto.executions.map((row) => row.position)).size !== dto.executions.length)
      throw new BadRequestException('As posições das séries devem ser únicas.');
    const submittedIds = dto.executions.map((row) => row.id).filter((id): id is number => id !== undefined);
    if (new Set(submittedIds).size !== submittedIds.length)
      throw new BadRequestException('Séries repetidas no envio.');
    if (dto.status === WorkoutStatus.IN_PROGRESS || dto.status === WorkoutStatus.COMPLETED) {
      if (!dto.performedAt) throw new BadRequestException('Informe o início do treino.');
    }
    if (dto.status === WorkoutStatus.COMPLETED && !dto.finishedAt)
      throw new BadRequestException('Informe o fim do treino.');
    if (dto.performedAt && dto.finishedAt && new Date(dto.finishedAt) < new Date(dto.performedAt))
      throw new BadRequestException('O fim do treino não pode preceder o início.');
    for (const row of dto.executions) {
      if (row.adherenceSnapshot && Object.values(row.adherenceSnapshot).some((value) => value !== null && (typeof value !== 'number' || !Number.isFinite(value))))
        throw new BadRequestException('Valores anteriores da série inválidos.');
      if (row.adherenceSnapshot && row.status !== ExecutionStatus.COMPLETED)
        throw new BadRequestException('Valores anteriores só podem ser registrados em séries realizadas.');
      if (row.status === ExecutionStatus.COMPLETED) {
        if (!row.startedAt || !row.finishedAt)
          throw new BadRequestException('Séries realizadas exigem início e fim.');
        if (new Date(row.finishedAt) < new Date(row.startedAt))
          throw new BadRequestException('O fim da série não pode preceder seu início.');
      }
    }
    if (dto.status === WorkoutStatus.COMPLETED && dto.executions.some((row) =>
      ![ExecutionStatus.COMPLETED, ExecutionStatus.SKIPPED].includes(row.status)))
      throw new BadRequestException('Conclua ou pule todas as séries antes de finalizar.');

    const resultId = await this.dataSource.transaction(async (manager) => {
      const operation = await manager.query<{ workout_id: string }[]>(
        'SELECT workout_id FROM workout_sync_operations WHERE user_id = $1 AND operation_id = $2',
        [actor.sub, dto.operationId],
      );
      const requestedId = operation[0]?.workout_id ?? dto.id;
      let workout = await manager.getRepository(Workout).findOne({
        where: { id: requestedId }, lock: { mode: 'pessimistic_write' },
      });
      const copying = dto.resolution === 'copy';
      if (workout && workout.athleteId !== actor.sub)
        throw new ForbiddenException('O treino não pertence ao atleta autenticado.');
      if (workout && workout.tenantId) {
        const [episode] = await manager.query<{ id: string }[]>(`
          SELECT id FROM athlete_tenant_associations
          WHERE id = $1 AND athlete_id = $2 AND tenant_id = $3
            AND status = 'active' AND ended_at IS NULL
        `, [workout.athleteTenantAssociationId, actor.sub, workout.tenantId]);
        if (!episode) throw new ForbiddenException('O vínculo do atleta não está ativo.');
      }
      if (workout) {
        const [access] = await manager.query<{ allowed: boolean }[]>(
          'SELECT can_read_athlete_workout($1::uuid, $2::uuid) AS allowed', [workout.id, actor.sub],
        );
        if (!access?.allowed) throw new ForbiddenException('Acesso ao treino revogado.');
      }
      if (operation.length) return operation[0].workout_id;
      if (copying && !workout) throw new NotFoundException('Treino original não encontrado.');
      if (workout && !copying) {
        const [version] = await manager.query<{ revision: string }[]>(
          'SELECT revision FROM workout_sync_versions WHERE workout_id = $1 FOR UPDATE', [workout.id],
        );
        if (dto.resolution !== 'force' && dto.baseRevision !== Number(version?.revision ?? 0))
          throw new ConflictException({
            code: 'WORKOUT_SYNC_CONFLICT', message: 'Treino alterado em outra origem.',
            currentState: { ...await this.workouts.findWorkout(workout.id, actor), syncRevision: Number(version?.revision ?? 0) },
          });
        if (workout.status === WorkoutStatus.COMPLETED && dto.status !== WorkoutStatus.COMPLETED)
          throw new ConflictException({
            code: 'WORKOUT_ALREADY_COMPLETED', message: 'Este treino já foi finalizado por você. Deseja continuar?',
            currentState: { ...await this.workouts.findWorkout(workout.id, actor), syncRevision: Number(version?.revision ?? 0) },
          });
        if (workout.createdBy !== actor.sub) {
          const current = await manager.find(Execution, { where: { workoutId: workout.id } });
          const byId = new Map(current.map((item) => [item.id, item]));
          const ordinary = dto.executions.filter((row) => row.setType !== enums.ExecutionSetType.CONTINGENCIA_OFFLINE);
          const contingency = dto.executions.filter((row) => row.setType === enums.ExecutionSetType.CONTINGENCIA_OFFLINE);
          if (contingency.some((row) => row.id || row.status !== ExecutionStatus.SKIPPED ||
            !current.some((saved) => saved.exerciseId === row.exerciseId)))
            throw new ForbiddenException('Série de contingência inválida.');
          if (current.length !== ordinary.length || ordinary.some((row) => {
            const saved = row.id ? byId.get(row.id) : null;
            return !saved || row.exerciseId !== saved.exerciseId ||
              (row.prescribedMetric1 !== undefined && row.prescribedMetric1 !== saved.prescribedMetric1) ||
              (row.prescribedMetric2 !== undefined && row.prescribedMetric2 !== saved.prescribedMetric2) ||
              (row.prescribedPse !== undefined && row.prescribedPse !== saved.prescribedPse) ||
              (row.prescribedRestDuration !== undefined && row.prescribedRestDuration !== saved.prescribedRestDuration) ||
              (row.metric2Type !== undefined && row.metric2Type !== saved.metric2Type) ||
              (row.setType !== undefined && row.setType !== saved.setType);
          })) throw new ForbiddenException('Somente o autor do treino pode alterar sua estrutura.');
        }
      }
      const targetId = copying ? randomUUID() : dto.id;
      const inserted = await manager.query<{ workout_id: string }[]>(`
        INSERT INTO workout_sync_operations(user_id, operation_id, workout_id)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING workout_id
      `, [actor.sub, dto.operationId, targetId]);
      if (!inserted.length) {
        const [previous] = await manager.query<{ workout_id: string }[]>(
          'SELECT workout_id FROM workout_sync_operations WHERE user_id = $1 AND operation_id = $2',
          [actor.sub, dto.operationId],
        );
        return previous.workout_id;
      }
      if (!workout || copying) {
        workout = manager.create(Workout, {
          id: targetId, athleteId: actor.sub, createdBy: actor.sub, updatedBy: actor.sub,
          tenantId: null, origin: 'athlete', workoutTemplateId: null,
          athleteTenantAssociationId: null,
          excludeFromAchievements: false,
          offlineConflictCopy: copying,
        });
      }
      if (workout.createdBy === actor.sub) {
        workout.templateName = dto.templateName.trim();
        workout.templateDescription = dto.templateDescription?.trim() ?? '';
        workout.scheduledDate = dto.scheduledDate ?? null;
      }
      workout.status = dto.status;
      workout.performedAt = dto.performedAt ? new Date(dto.performedAt) : null;
      workout.finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : null;
      workout.updatedBy = actor.sub;
      await manager.save(workout);

      const existing = copying ? [] : await manager.find(Execution, { where: { workoutId: targetId } });
      const byId = new Map(existing.map((item) => [item.id, item]));
      const keepIds = new Set(dto.executions.map((row) => row.id).filter((id): id is number => !!id));
      if (existing.length) {
        const offset = Math.max(...existing.map((row) => row.position)) + dto.executions.length + 1;
        await manager.createQueryBuilder().update(Execution)
          .set({ position: () => `position + ${offset}` })
          .where('workout_id = :id', { id: targetId }).execute();
        const removed = existing.filter((row) => !keepIds.has(row.id)).map((row) => row.id);
        if (removed.length) await manager.delete(Execution, { id: In(removed), workoutId: targetId });
      }
      const exerciseIds = [...new Set(dto.executions.map((row) => row.exerciseId))];
      const exercises = exerciseIds.length ? await manager.find(Exercise, { where: { id: In(exerciseIds) } }) : [];
      if (exercises.length !== exerciseIds.length)
        throw new BadRequestException('Exercício não encontrado.');
      const changedExecutions: Execution[] = [];
      for (const input of dto.executions) {
        const saved = !copying && input.id ? byId.get(input.id) : undefined;
        if (input.id && !copying && !saved)
          throw new BadRequestException('Série não pertence a este treino.');
        const execution = saved ?? manager.create(Execution, {
          workoutId: targetId, metric1Type: 'v', metric2Type: null,
          status: ExecutionStatus.PENDING, startedAt: null, finishedAt: null,
        });
        execution.exerciseId = input.exerciseId;
        execution.position = input.position;
        if (input.metric2Type !== undefined) execution.metric2Type = input.metric2Type;
        for (const field of [
          'prescribedMetric1', 'prescribedMetric2', 'prescribedPse', 'prescribedRestDuration',
          'performedMetric1', 'performedMetric2', 'performedPse', 'performedRestDuration',
          'performedNote', 'setType',
        ] as const) {
          if (input[field] !== undefined) (execution as any)[field] = input[field];
        }
        execution.status = input.status;
        if (input.adherenceSnapshot) execution.adherenceSnapshot = input.adherenceSnapshot;
        execution.startedAt = input.startedAt ? new Date(input.startedAt) : null;
        execution.finishedAt = input.finishedAt ? new Date(input.finishedAt) : null;
        changedExecutions.push(execution);
      }
      if (changedExecutions.length) await manager.save(Execution, changedExecutions);
      if (workout.createdBy === actor.sub && dto.exerciseNotes) {
        const kept = dto.exerciseNotes.map((note) => note.exerciseId);
        if (kept.length)
          await manager.query('DELETE FROM workout_exercise_notes WHERE workout_id = $1 AND exercise_id <> ALL($2::int[])', [targetId, kept]);
        else
          await manager.query('DELETE FROM workout_exercise_notes WHERE workout_id = $1', [targetId]);
      }
      if (dto.exerciseNotes?.length) {
        const notes = await manager.find(WorkoutExerciseNote, { where: { workoutId: targetId } });
        const notesByExercise = new Map(notes.map((note) => [note.exerciseId, note]));
        const changedNotes: WorkoutExerciseNote[] = [];
        for (const input of dto.exerciseNotes) {
          if (!exerciseIds.includes(input.exerciseId))
            throw new BadRequestException('Nota não pertence a este treino.');
          const note = notesByExercise.get(input.exerciseId) ?? manager.create(WorkoutExerciseNote, {
            workoutId: targetId, exerciseId: input.exerciseId, note: null,
            createdBy: actor.sub,
          });
          note.athleteNote = input.athleteNote?.trim() || null;
          note.updatedBy = actor.sub;
          changedNotes.push(note);
        }
        await manager.save(WorkoutExerciseNote, changedNotes);
      }
      return targetId;
    });
    return this.findVersionedWorkout(resultId, actor);
  }
}
