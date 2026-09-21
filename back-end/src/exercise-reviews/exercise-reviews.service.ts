import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExerciseReviewQueryDto } from './exercise-reviews.dto';

const completed = 'completed';
const number = (value: unknown) => value === null || value === undefined ? null : Number(value);

@Injectable()
export class ExerciseReviewsService {
	constructor(private readonly dataSource: DataSource) {}

	private async authorize(athleteId: string, actor: JwtPayload) {
		if (actor.sub === athleteId) return;
		if (actor.roles.some((role) => [Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role))) return;
		if (actor.roles.includes(Role.TENANT_ADMIN)) {
			const exists = await this.dataSource.query<{ ok: number }[]>(
				`SELECT 1 AS ok FROM users WHERE id = $1 AND tenant_id = $2`, [athleteId, actor.tenantId],
			);
			if (exists.length) return;
		}
		if (actor.roles.some((role) => [Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER].includes(role))) {
			const association = await this.dataSource.getRepository(AthleteTrainerAssociation).existsBy({ athleteId, trainerId: actor.sub, endDate: IsNull() });
			if (association) return;
		}
		throw new ForbiddenException('Você não pode visualizar este atleta.');
	}

	private period(query: ExerciseReviewQueryDto) {
		// Exercise reviews intentionally have one fixed window.  Keeping this on the
		// server also prevents callers from requesting a different period directly.
		const to = new Date();
		const from = new Date(to);
		from.setMonth(from.getMonth() - 3);
		return { from: from.toISOString(), to: to.toISOString() };
	}

	private async exercise(exerciseId: number) {
		const exercise = await this.dataSource.getRepository(Exercise).findOne({ where: { id: exerciseId }, relations: { metric1: true, metric2: true } });
		if (!exercise) throw new NotFoundException('Exercício não encontrado.');
		return exercise;
	}

	async summary(athleteId: string, exerciseId: number, query: ExerciseReviewQueryDto, actor: JwtPayload) {
		await this.authorize(athleteId, actor);
		const exercise = await this.exercise(exerciseId);
		const { from, to } = this.period(query);
		const rows = await this.dataSource.query<any[]>(`
			SELECT w.id AS "workoutId", w.template_name AS "workoutName", w.performed_at AS "performedAt", w.performed_at::date::text AS day,
			 e.id AS "executionId", e.performed_metric_1 AS "metric1", e.performed_metric_2 AS "metric2", e.predicted_rm AS "predictedRm"
			FROM executions e JOIN workouts w ON w.id=e.workout_id
			WHERE w.tenant_id = $1 AND w.athlete_id=$2 AND e.exercise_id=$3
			 AND w.status='completed' AND e.status='completed' AND w.performed_at BETWEEN $4 AND $5
			ORDER BY w.performed_at ASC, e.position ASC`, [actor.tenantId, athleteId, exerciseId, from, to]);
		const history = rows.map((r) => ({ ...r, metric1: number(r.metric1), metric2: number(r.metric2), predictedRm: number(r.predictedRm) }));
		const m1 = exercise.metric1.name, m2 = exercise.metric2?.name ?? null;
		const isWeightReps = [m1, m2].sort().join('|') === 'peso|repeticoes';
		const value = (row: any, metric: string) => number(m1 === metric ? row.metric1 : row.metric2);
		const series = history.map((r) => ({
			day: r.day, date: r.performedAt, workoutId: r.workoutId, predictedRm: r.predictedRm,
			repetitions: m1 === 'repeticoes' || m2 === 'repeticoes' ? value(r, 'repeticoes') : null,
			weight: m1 === 'peso' || m2 === 'peso' ? value(r, 'peso') : null,
			distance: m1 === 'distancia' || m2 === 'distancia' ? value(r, 'distancia') : null,
			duration: m1 === 'tempo' || m2 === 'tempo' ? value(r, 'tempo') : null,
		}));
		const byDay = new Map<string, typeof series>();
		for (const item of series) {
			byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
		}
		const chart = [...byDay.entries()].map(([day, daySeries]) => {
			const bestRm = [...daySeries].filter((item) => item.predictedRm !== null).sort((a, b) => (b.predictedRm ?? 0) - (a.predictedRm ?? 0))[0];
			const latest = daySeries.at(-1)!;
			const tonnage = isWeightReps ? daySeries.reduce((total, item) => total + (item.weight ?? 0) * (item.repetitions ?? 0), 0) : null;
			return {
				...latest,
				date: `${day}T12:00:00.000Z`,
				// 1RM is the best eligible set on that training day, never an arbitrary set.
				predictedRm: bestRm?.predictedRm ?? null,
				tonnage,
				pace: latest.distance && latest.duration ? latest.duration / latest.distance : null,
			};
		});
		const best = isWeightReps ? [...chart].filter((s) => s.predictedRm !== null).sort((a,b) => (b.predictedRm ?? 0)-(a.predictedRm ?? 0))[0] ?? null : null;
		const rp = await this.dataSource.query<any[]>(`SELECT value, measured_at AS "measuredAt" FROM personal_records WHERE athlete_id=$1 AND exercise_id=$2 ORDER BY measured_at DESC LIMIT 1`, [athleteId, exerciseId]);
		return { exercise: { id: exercise.id, name: exercise.name, metrics: [exercise.metric1, exercise.metric2].filter(Boolean) }, period: { from, to }, currentRp: rp[0] ? { value: number(rp[0].value), measuredAt: rp[0].measuredAt } : null, bestSet: best, estimatedRm: best?.predictedRm ?? null, charts: chart };
	}

	async workouts(athleteId: string, exerciseId: number, query: ExerciseReviewQueryDto, actor: JwtPayload) {
		await this.authorize(athleteId, actor); const exercise = await this.exercise(exerciseId);
		const { from, to } = this.period(query), limit = query.limit ?? 20, offset = ((query.page ?? 1) - 1) * limit;
		const rows = await this.dataSource.query<any[]>(`
			WITH selected_workouts AS (
				SELECT w.id, w.template_name AS "workoutName", w.performed_at AS "performedAt"
				FROM workouts w JOIN executions e ON e.workout_id=w.id
				WHERE w.tenant_id=$1 AND w.athlete_id=$2 AND e.exercise_id=$3 AND w.status='completed' AND e.status='completed' AND w.performed_at BETWEEN $4 AND $5
				GROUP BY w.id ORDER BY w.performed_at DESC LIMIT $6 OFFSET $7
			)
			SELECT w.id, w."workoutName", w."performedAt", e.position, e.set_type AS "setType", e.performed_metric_1 AS "metric1", e.performed_metric_2 AS "metric2", e.predicted_rm AS "predictedRm", e.performed_note AS note
			FROM selected_workouts w JOIN executions e ON e.workout_id=w.id AND e.exercise_id=$3 AND e.status='completed'
			ORDER BY w."performedAt" DESC, e.position ASC`, [actor.tenantId, athleteId, exerciseId, from, to, limit, offset]);
		const isWeightReps = [exercise.metric1.name, exercise.metric2?.name].sort().join('|') === 'peso|repeticoes';
		const groups = new Map<string, any>();
		for (const row of rows) {
			const item = groups.get(row.id) ?? { id: row.id, workoutName: row.workoutName, performedAt: row.performedAt, series: [] };
			const metric1 = number(row.metric1), metric2 = number(row.metric2);
			item.series.push({ position: Number(row.position), setType: row.setType, metric1, metric2, predictedRm: number(row.predictedRm), note: row.note });
			groups.set(row.id, item);
		}
		const items = [...groups.values()].map((item) => {
			const tonnage = isWeightReps ? item.series.reduce((total: number, set: any) => total + (exercise.metric1.name === 'peso' ? set.metric1 : set.metric2 ?? 0) * (exercise.metric1.name === 'repeticoes' ? set.metric1 : set.metric2 ?? 0), 0) : null;
			return { ...item, sets: item.series.length, bestPredictedRm: item.series.reduce((best: number | null, set: any) => Math.max(best ?? 0, set.predictedRm ?? 0) || null, null), tonnage };
		});
		return { page: query.page ?? 1, limit, items };
	}

	async latest(athleteId: string, exerciseId: number, actor: JwtPayload) {
		await this.authorize(athleteId, actor); await this.exercise(exerciseId);
		const rows = await this.dataSource.query<any[]>(`SELECT w.id AS "workoutId", w.template_name AS "workoutName", w.performed_at AS "performedAt", e.performed_metric_1 AS "metric1", e.performed_metric_2 AS "metric2", e.predicted_rm AS "predictedRm", e.set_type AS "setType", e.performed_note AS note FROM workouts w JOIN executions e ON e.workout_id=w.id WHERE w.tenant_id=$1 AND w.athlete_id=$2 AND e.exercise_id=$3 AND w.status='completed' AND e.status='completed' AND w.performed_at=(SELECT max(w2.performed_at) FROM workouts w2 JOIN executions e2 ON e2.workout_id=w2.id WHERE w2.athlete_id=$2 AND e2.exercise_id=$3 AND w2.status='completed' AND e2.status='completed') ORDER BY e.position`, [actor.tenantId, athleteId, exerciseId]);
		return { item: rows.length ? rows.map((r) => ({ ...r, metric1: number(r.metric1), metric2: number(r.metric2), predictedRm: number(r.predictedRm) })) : null };
	}
}
