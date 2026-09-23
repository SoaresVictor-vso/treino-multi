import type { Measurement } from './entities/measurement.entity';

type MeasurementDefinition = Pick<
	Measurement,
	| 'key'
	| 'name'
	| 'formula'
	| 'valueFormula'
	| 'staticWeight'
	| 'dynamicWeight'
	| 'icon'
	| 'unit'
	| 'aggregation'
	| 'presentation'
> & {
	metric1Name: string | null;
	metric2Name: string | null;
};

const standardPresentation = {
	containerClass: 'bg-surface-container-high border-outline-variant',
	iconClass: 'text-primary-fixed',
	valueClass: 'text-on-surface',
	labelClass: 'text-on-surface-variant',
};

export const MEASUREMENT_DEFINITIONS = [
	{
		key: 'duration',
		name: 'Duração',
		metric1Name: null,
		metric2Name: null,
		formula: 'curr.total = curr.total + duration',
		valueFormula: 'curr.total',
		staticWeight: 1,
		dynamicWeight: 1,
		icon: 'timer',
		unit: 's',
		aggregation: 'sum',
		presentation: standardPresentation,
	},
	{
		key: 'tonnage',
		name: 'Tonelagem',
		metric1Name: 'peso',
		metric2Name: 'repeticoes',
		formula: 'curr.total = curr.total + peso * repeticoes',
		valueFormula: 'curr.total',
		staticWeight: 5,
		dynamicWeight: 1,
		icon: 'dumbbell',
		unit: 'kg',
		aggregation: 'sum',
		presentation: standardPresentation,
	},
	{
		key: 'average-pace',
		name: 'Pace médio',
		metric1Name: 'distancia',
		metric2Name: 'tempo',
		formula:
			'curr.distance = curr.distance + distancia; curr.duration = curr.duration + tempo',
		valueFormula: 'curr.duration / curr.distance',
		staticWeight: 3,
		dynamicWeight: 1,
		icon: 'gauge',
		unit: 's/m',
		aggregation: 'average',
		presentation: standardPresentation,
	},
	{
		key: 'average-rpe',
		name: 'RPE médio',
		metric1Name: null,
		metric2Name: null,
		formula: 'curr.total = curr.total + rpe; curr.count = curr.count + 1',
		valueFormula: 'curr.total / curr.count',
		staticWeight: 2,
		dynamicWeight: 1,
		icon: 'activity',
		unit: null,
		aggregation: 'average',
		presentation: standardPresentation,
	},
	{
		key: 'effort-adherence',
		name: 'Aderência de esforço',
		metric1Name: null,
		metric2Name: null,
		formula:
			'curr.matches = curr.matches + ((prescribedRpe > 0) * (rpe === prescribedRpe)); curr.count = curr.count + 1',
		valueFormula: '(curr.matches / curr.count) * 100',
		staticWeight: 4,
		dynamicWeight: 1,
		icon: 'target',
		unit: '%',
		aggregation: 'average',
		presentation: standardPresentation,
	},
	{
		key: 'workout-adherence',
		name: 'Aderência no treino',
		metric1Name: null,
		metric2Name: null,
		formula:
			'curr.points = curr.points + completed * (prescribedMetric1 > 0) * (1 + metricsMatch); curr.count = curr.count + (completed === 1) + ((completed === 0) * (prescribedMetric1 > 0))',
		valueFormula: '(curr.points / (2 * curr.count)) * 100',
		staticWeight: 4,
		dynamicWeight: 1,
		icon: 'check-circle',
		unit: '%',
		aggregation: 'average',
		presentation: standardPresentation,
	},
] as const satisfies readonly MeasurementDefinition[];
