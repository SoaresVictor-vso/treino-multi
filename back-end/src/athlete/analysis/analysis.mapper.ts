import type { MeasurementPresentation } from '../../measurements/entities/measurement.entity';

export interface IndicatorRow {
	period: 'current' | 'previous';
	startDay: string;
	endDay: string;
	averageRpe: string | null;
	adherence: string | null;
	rpeAdherence: string | null;
}
export interface MeasurementRow {
	measurementId: string;
	key?: string;
	name: string;
	icon: string | null;
	presentation: MeasurementPresentation | null;
	unit: string | null;
	aggregation: 'sum' | 'average';
	period: 'current' | 'previous';
	day: string;
	value: string;
	consideredSets?: string;
}
export interface LifetimeRow {
	totalTonnage: string | null;
	totalWorkouts: string;
	totalRepetitions: string;
	totalSets: string;
}
export interface ExerciseRow {
	exerciseId: number;
	name: string;
	totalWorkouts: string;
}
export interface ExerciseLifetimeRow {
	totalTonnage: string | null;
	totalRepetitions: string | null;
	totalSets: string;
	totalWorkouts: string;
}

const nullableNumber = (value: string | null): number | null =>
	value === null ? null : Number(value);
export const mapIndicators = (rows: IndicatorRow[]) => {
	const current = rows.find((row) => row.period === 'current');
	const previous = rows.find((row) => row.period === 'previous');
	return {
		averageRpe: {
			current: nullableNumber(current?.averageRpe ?? null),
			previous: nullableNumber(previous?.averageRpe ?? null),
		},
		adherence: {
			current: nullableNumber(current?.adherence ?? null),
			previous: nullableNumber(previous?.adherence ?? null),
		},
		rpeAdherence: {
			current: nullableNumber(current?.rpeAdherence ?? null),
			previous: nullableNumber(previous?.rpeAdherence ?? null),
		},
	};
};

export const mapPeriod = (rows: IndicatorRow[]) => {
	const current = rows.find((row) => row.period === 'current');
	const previous = rows.find((row) => row.period === 'previous');
	return {
		currentStartDay: current?.startDay ?? '',
		previousStartDay: previous?.startDay ?? '',
		endDay: current?.endDay ?? '',
	};
};

export function mapMeasurements(rows: MeasurementRow[]) {
	const groups = new Map<
		string,
		{
			measurementId: string;
			key?: string;
			name: string;
			icon: string | null;
			presentation: MeasurementPresentation | null;
			unit: string | null;
			aggregation: 'sum' | 'average';
			currentPeriod: { day: string; value: number; consideredSets: number }[];
			previousPeriod: { day: string; value: number; consideredSets: number }[];
			currentTotal: number | null;
			previousTotal: number | null;
		}
	>();
	const adherenceWeights = new Map<
		string,
		{ current: number; previous: number; currentWeighted: number; previousWeighted: number }
	>();
	for (const row of rows) {
		let group = groups.get(row.measurementId);
		if (!group) {
			group = {
				measurementId: row.measurementId,
				key: row.key,
				name: row.name,
				icon: row.icon,
				presentation: row.presentation,
				unit: row.unit,
				aggregation: row.aggregation,
				currentPeriod: [],
				previousPeriod: [],
				currentTotal: null,
				previousTotal: null,
			};
			groups.set(row.measurementId, group);
		}
		const value = Number(row.value);
		const consideredSets = Number(row.consideredSets ?? 0);
		const points =
			row.period === 'current' ? group.currentPeriod : group.previousPeriod;
		points.push({ day: row.day, value, consideredSets });
		const totalKey = row.period === 'current' ? 'currentTotal' : 'previousTotal';
		group[totalKey] = (group[totalKey] ?? 0) + value;
		if (row.key === 'effort-adherence') {
			const weight = consideredSets;
			const weighted = adherenceWeights.get(row.measurementId) ?? {
				current: 0,
				previous: 0,
				currentWeighted: 0,
				previousWeighted: 0,
			};
			weighted[row.period] += weight;
			weighted[row.period === 'current' ? 'currentWeighted' : 'previousWeighted'] += value * weight;
			adherenceWeights.set(row.measurementId, weighted);
		}
	}
	for (const group of groups.values()) {
		if (group.key === 'effort-adherence') {
			const weights = adherenceWeights.get(group.measurementId);
			if (weights?.current)
				group.currentTotal = weights.currentWeighted / weights.current;
			else group.currentTotal = null;
			if (weights?.previous)
				group.previousTotal = weights.previousWeighted / weights.previous;
			else group.previousTotal = null;
		} else if (group.aggregation === 'average') {
			if (group.currentTotal !== null)
				group.currentTotal /= group.currentPeriod.length;
			if (group.previousTotal !== null)
				group.previousTotal /= group.previousPeriod.length;
		}
	}
	return [...groups.values()].filter(
		(group) =>
			group.currentPeriod.length > 0 ||
			(group.key === 'effort-adherence' && group.previousPeriod.length > 0),
	);
}

export const mapLifetime = (row: LifetimeRow) => ({
	totalTonnage: nullableNumber(row.totalTonnage),
	totalWorkouts: Number(row.totalWorkouts),
	totalRepetitions: Number(row.totalRepetitions),
	totalSets: Number(row.totalSets),
});
export const mapExerciseLifetime = (row: ExerciseLifetimeRow) => ({
	totalTonnage: nullableNumber(row.totalTonnage),
	totalRepetitions: nullableNumber(row.totalRepetitions),
	totalSets: Number(row.totalSets),
	totalWorkouts: Number(row.totalWorkouts),
});
export const mapExercises = (rows: ExerciseRow[]) =>
	rows.map((row) => ({
		exerciseId: Number(row.exerciseId),
		name: row.name,
		totalWorkouts: Number(row.totalWorkouts),
	}));
