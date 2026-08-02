import type { Exercise } from './types';

export const exercises: Exercise[] = [
	{
		id: 1,
		name: 'Agachamento livre',
		metric_1: 'repetition',
		metric_2: 'weight',
	},
	{ id: 2, name: 'Supino', metric_1: 'repetition', metric_2: 'weight' },
	{
		id: 3,
		name: 'Levantamento terra',
		metric_1: 'repetition',
		metric_2: 'weight',
	},
	{ id: 4, name: 'Corrida', metric_1: 'distance', metric_2: 'pace' },
];

export const metricLabels = {
	repetition: 'Repetições',
	weight: 'Peso',
	time: 'Tempo',
	distance: 'Distância',
	pace: 'Ritmo',
} as const;

export const metricUnits = {
	repetition: 'reps',
	weight: 'kg',
	time: 'min',
	distance: 'km',
	pace: 'min/km',
} as const;
