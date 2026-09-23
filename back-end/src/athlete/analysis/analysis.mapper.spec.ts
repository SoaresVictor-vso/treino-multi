import {
	mapExerciseLifetime,
	mapIndicators,
	mapMeasurements,
} from './analysis.mapper';

describe('analysis mapper', () => {
	it('keeps missing RPE distinct from a real zero adherence and preserves previous values', () => {
		const result = mapIndicators([
			{
				period: 'current',
				startDay: '2026-09-16',
				endDay: '2026-09-23',
				averageRpe: null,
				adherence: '0',
				rpeAdherence: null,
			},
			{
				period: 'previous',
				startDay: '2026-09-09',
				endDay: '2026-09-16',
				averageRpe: '7.5',
				adherence: '50',
				rpeAdherence: '80',
			},
		]);
		expect(result.averageRpe).toEqual({ current: null, previous: 7.5 });
		expect(result.adherence).toEqual({ current: 0, previous: 50 });
		expect(result.rpeAdherence.current).toBeNull();
	});

	it('groups all measurements generically and omits those without current data', () => {
		const base = {
			measurementId: 'one',
			name: 'Any measurement',
			icon: null,
			presentation: null,
			unit: null,
			aggregation: 'sum' as const,
		};
		const result = mapMeasurements([
			{ ...base, period: 'current', day: '2026-09-21', value: '0' },
			{ ...base, period: 'previous', day: '2026-09-14', value: '3.5' },
			{
				...base,
				measurementId: 'two',
				period: 'previous',
				day: '2026-09-14',
				value: '8',
			},
		]);
		expect(result).toHaveLength(1);
		expect(result[0].currentPeriod).toEqual([{ day: '2026-09-21', value: 0 }]);
		expect(result[0].previousTotal).toBe(3.5);
	});

	it('compares average measurements as averages instead of summing their daily values', () => {
		const base = {
			measurementId: 'rpe',
			name: 'RPE',
			icon: null,
			presentation: null,
			unit: null,
			aggregation: 'average' as const,
		};
		const [result] = mapMeasurements([
			{ ...base, period: 'current', day: '2026-09-21', value: '4' },
			{ ...base, period: 'current', day: '2026-09-22', value: '8' },
			{ ...base, period: 'previous', day: '2026-09-14', value: '5' },
		]);
		expect(result.currentTotal).toBe(6);
		expect(result.previousTotal).toBe(5);
	});

	it('distinguishes unsupported exercise metrics from supported zero results', () => {
		expect(
			mapExerciseLifetime({
				totalTonnage: null,
				totalRepetitions: '0',
				totalSets: '1',
				totalWorkouts: '1',
			}),
		).toEqual({
			totalTonnage: null,
			totalRepetitions: 0,
			totalSets: 1,
			totalWorkouts: 1,
		});
	});
});
