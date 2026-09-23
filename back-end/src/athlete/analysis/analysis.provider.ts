import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { athleteAccessSql } from './sql/analysis-access.sql';
import {
	indicatorsSql,
	exerciseThreeMonthIndicatorsSql,
	lifetimeSql,
	exercisesSql,
	exerciseLifetimeSql,
} from './sql/athlete-analysis.sql';
import { measurementsSql } from './sql/athlete-measurements.sql';
import type {
	IndicatorRow,
	MeasurementRow,
	LifetimeRow,
	ExerciseRow,
	ExerciseLifetimeRow,
} from './analysis.mapper';

export interface AthleteAccessRow {
	tenantId: string | null;
	name: string;
	isTrainer: boolean;
}

@Injectable()
export class AnalysisProvider {
	constructor(private readonly dataSource: DataSource) {}
	access(athleteId: string, actorId: string) {
		return this.dataSource.query<AthleteAccessRow[]>(athleteAccessSql, [
			athleteId,
			actorId,
		]);
	}
	indicators(
		athleteId: string,
		tenantId: string,
		days: number,
		exerciseId: number | null = null,
	) {
		return this.dataSource.query<IndicatorRow[]>(indicatorsSql, [
			athleteId,
			tenantId,
			days,
			exerciseId,
		]);
	}
	exerciseThreeMonthIndicators(
		athleteId: string,
		tenantId: string,
		exerciseId: number,
		from: string,
		to: string,
	) {
		return this.dataSource.query<IndicatorRow[]>(
			exerciseThreeMonthIndicatorsSql,
			[athleteId, tenantId, from, to, exerciseId],
		);
	}
	measurements(athleteId: string, tenantId: string, days: number) {
		return this.dataSource.query<MeasurementRow[]>(measurementsSql, [
			athleteId,
			tenantId,
			days,
		]);
	}
	lifetime(athleteId: string, tenantId: string) {
		return this.dataSource.query<LifetimeRow[]>(lifetimeSql, [
			athleteId,
			tenantId,
		]);
	}
	exercises(athleteId: string, tenantId: string) {
		return this.dataSource.query<ExerciseRow[]>(exercisesSql, [
			athleteId,
			tenantId,
		]);
	}
	exerciseLifetime(athleteId: string, tenantId: string, exerciseId: number) {
		return this.dataSource.query<ExerciseLifetimeRow[]>(exerciseLifetimeSql, [
			athleteId,
			tenantId,
			exerciseId,
		]);
	}
}
