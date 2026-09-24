import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ExerciseReviewQueryDto } from './exercise-reviews.dto';
import { AnalysisService } from '../athlete/analysis/analysis.service';
import { exerciseReviewPeriod } from './exercise-review-period';
import { ExerciseReviewsProvider, ReviewContext } from './exercise-reviews.provider';

const number = (value: unknown) => value === null || value === undefined ? null : Number(value);

@Injectable()
export class ExerciseReviewsService {
	constructor(private readonly provider: ExerciseReviewsProvider, private readonly analysisService: AnalysisService) {}

	analysis(athleteId: string, exerciseId: number, period: '7' | '15' | '30' | '3m', actor: JwtPayload) {
		return this.analysisService.exercise(athleteId, exerciseId, period, actor);
	}

	private authorize(row: ReviewContext) {
		if (!row.allowed) throw new ForbiddenException('Você não pode visualizar este atleta.');
		if (!row.exercise) throw new NotFoundException('Exercício não encontrado.');
		return row.exercise;
	}

	private period(query: ExerciseReviewQueryDto) {
		void query;
		// Exercise reviews intentionally have one fixed window.  Keeping this on the
		// server also prevents callers from requesting a different period directly.
		return exerciseReviewPeriod();
	}

	async summary(athleteId: string, exerciseId: number, query: ExerciseReviewQueryDto, actor: JwtPayload) {
		const { from, to } = this.period(query);
		const result = await this.provider.summary(actor.sub, athleteId, exerciseId, from, to);
		const exercise = this.authorize(result);
		const history = result.history.map((r) => ({ ...r, metric1: number(r.metric1), metric2: number(r.metric2), predictedRm: number(r.predictedRm) }));
		const m1 = exercise.metrics[0].name, m2 = exercise.metrics[1]?.name ?? null;
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
		return { athleteName: result.athleteName ?? '', exercise, period: { from, to }, currentRp: result.currentRp ? { value: number(result.currentRp.value), measuredAt: result.currentRp.measuredAt } : null, bestSet: best, estimatedRm: best?.predictedRm ?? null, charts: chart };
	}

	async workouts(athleteId: string, exerciseId: number, query: ExerciseReviewQueryDto, actor: JwtPayload) {
		const { from, to } = this.period(query), limit = query.limit ?? 20, offset = ((query.page ?? 1) - 1) * limit;
		const result = await this.provider.workouts(actor.sub, athleteId, exerciseId, from, to, limit, offset);
		const exercise = this.authorize(result);
		const rows = result.rows;
		const isWeightReps = [exercise.metrics[0].name, exercise.metrics[1]?.name].sort().join('|') === 'peso|repeticoes';
		const groups = new Map<string, any>();
		for (const row of rows) {
			const item = groups.get(row.id) ?? { id: row.id, workoutName: row.workoutName, performedAt: row.performedAt, series: [] };
			const metric1 = number(row.metric1), metric2 = number(row.metric2);
			item.series.push({ position: Number(row.position), setType: row.setType, metric1, metric2, predictedRm: number(row.predictedRm), note: row.note });
			groups.set(row.id, item);
		}
		const items = [...groups.values()].map((item) => {
			const tonnage = isWeightReps ? item.series.reduce((total: number, set: any) => total + (exercise.metrics[0].name === 'peso' ? set.metric1 : set.metric2 ?? 0) * (exercise.metrics[0].name === 'repeticoes' ? set.metric1 : set.metric2 ?? 0), 0) : null;
			return { ...item, sets: item.series.length, bestPredictedRm: item.series.reduce((best: number | null, set: any) => Math.max(best ?? 0, set.predictedRm ?? 0) || null, null), tonnage };
		});
		return { page: query.page ?? 1, limit, items };
	}

	async latest(athleteId: string, exerciseId: number, actor: JwtPayload) {
		const result = await this.provider.latest(actor.sub, athleteId, exerciseId);
		this.authorize(result);
		const rows = result.rows;
		return { item: rows.length ? rows.map((r) => ({ ...r, metric1: number(r.metric1), metric2: number(r.metric2), predictedRm: number(r.predictedRm) })) : null };
	}
}
