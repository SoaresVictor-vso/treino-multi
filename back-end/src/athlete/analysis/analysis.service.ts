import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Role } from '../../common/enums/role.enum';
import { exerciseReviewPeriod } from '../../exercise-reviews/exercise-review-period';
import { AnalysisProvider } from './analysis.provider';
import {
	mapExerciseLifetime,
	mapExercises,
	mapIndicators,
	mapLifetime,
	mapMeasurements,
	mapPeriod,
} from './analysis.mapper';

@Injectable()
export class AnalysisService {
	constructor(private readonly provider: AnalysisProvider) {}

	private validateDays(days: number) {
		if (![7, 15, 30].includes(days))
			throw new BadRequestException('Período deve ser 7, 15 ou 30 dias.');
	}

	private async authorize(
		athleteId: string,
		actor: JwtPayload,
	): Promise<{ tenantId: string; name: string }> {
		const [athlete] = await this.provider.access(athleteId, actor.sub);
		if (!athlete || !athlete.tenantId)
			throw new NotFoundException('Atleta não encontrado.');
		const organization = actor.roles.some((role) =>
			[Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role),
		);
		const tenantAdmin = actor.roles.some((role) =>
			[Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
		);
		if (
			!organization &&
			actor.sub !== athleteId &&
			!(actor.tenantId === athlete.tenantId && (tenantAdmin || athlete.isTrainer))
		)
			throw new ForbiddenException('Você não pode visualizar este atleta.');
		return { tenantId: athlete.tenantId, name: athlete.name };
	}

	async athlete(athleteId: string, days: number, actor: JwtPayload) {
		this.validateDays(days);
		const athlete = await this.authorize(athleteId, actor);
		const [indicatorRows, measurementRows, lifetimeRows, exerciseRows] =
			await Promise.all([
				this.provider.indicators(athleteId, athlete.tenantId, days),
				this.provider.measurements(athleteId, athlete.tenantId, days),
				this.provider.lifetime(athleteId, athlete.tenantId),
				this.provider.exercises(athleteId, athlete.tenantId),
			]);
		return {
			athleteName: athlete.name,
			days,
			period: mapPeriod(indicatorRows),
			indicators: mapIndicators(indicatorRows),
			measurements: mapMeasurements(measurementRows),
			lifetime: mapLifetime(lifetimeRows[0]),
			exercises: mapExercises(exerciseRows),
		};
	}

	async exercise(
		athleteId: string,
		exerciseId: number,
		period: '7' | '15' | '30' | '3m',
		actor: JwtPayload,
	) {
		if (period !== '3m') this.validateDays(Number(period));
		const athlete = await this.authorize(athleteId, actor);
		const { from, to } = exerciseReviewPeriod();
		const indicatorPromise =
			period === '3m'
				? this.provider.exerciseThreeMonthIndicators(
						athleteId,
						athlete.tenantId,
						exerciseId,
						from,
						to,
					)
				: this.provider.indicators(
						athleteId,
						athlete.tenantId,
						Number(period),
						exerciseId,
					);
		const [indicatorRows, lifetimeRows] = await Promise.all([
			indicatorPromise,
			this.provider.exerciseLifetime(athleteId, athlete.tenantId, exerciseId),
		]);
		if (!lifetimeRows.length)
			throw new NotFoundException('Exercício não encontrado.');
		return {
			period,
			indicators: mapIndicators(indicatorRows),
			lifetime: mapExerciseLifetime(lifetimeRows[0]),
		};
	}
}
