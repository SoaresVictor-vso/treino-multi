import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { exerciseReviewPeriod } from '../../exercise-reviews/exercise-review-period';
import { AnalysisProvider } from './analysis.provider';
import {
	mapExerciseLifetime,
	mapExercises,
	mapIndicators,
	mapLifetime,
	mapMeasurements,
} from './analysis.mapper';

const localDayKey = (date: Date) => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
};

const shiftDay = (dayKey: string, offset: number) => {
	const date = new Date(`${dayKey}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + offset);
	return date.toISOString().slice(0, 10);
};

const periodForDays = (days: number) => {
	const today = localDayKey(new Date());
	return {
		currentStartDay: shiftDay(today, -(days - 1)),
		previousStartDay: shiftDay(today, -(2 * days - 1)),
		endDay: shiftDay(today, 1),
	};
};

@Injectable()
export class AnalysisService {
	constructor(private readonly provider: AnalysisProvider) {}

	private validateDays(days: number) {
		if (![7, 15, 30].includes(days))
			throw new BadRequestException('Período deve ser 7, 15 ou 30 dias.');
	}

	private authorize(row: { found: boolean; allowed: boolean }) {
		if (!row?.found) throw new NotFoundException('Atleta não encontrado.');
		if (!row.allowed)
			throw new ForbiddenException('Você não pode visualizar este atleta.');
	}

	async athlete(athleteId: string, days: number, actor: JwtPayload) {
		this.validateDays(days);
		const row = await this.provider.athlete(athleteId, actor.sub, days);
		this.authorize(row);
		return {
			athleteName: row.name,
			days,
			period: periodForDays(days),
			measurements: mapMeasurements(row.measurements),
			lifetime: mapLifetime(row.lifetime[0]),
			exercises: mapExercises(row.exercises),
		};
	}

	async exercise(
		athleteId: string,
		exerciseId: number,
		period: '7' | '15' | '30' | '3m',
		actor: JwtPayload,
	) {
		if (period !== '3m') this.validateDays(Number(period));
		const { from, to } = exerciseReviewPeriod();
		const row = await this.provider.exercise(
			athleteId, actor.sub, period, exerciseId, from, to,
		);
		this.authorize(row);
		if (!row.lifetime.length)
			throw new NotFoundException('Exercício não encontrado.');
		return {
			period,
			indicators: mapIndicators(row.indicators),
			lifetime: mapExerciseLifetime(row.lifetime[0]),
		};
	}
}
