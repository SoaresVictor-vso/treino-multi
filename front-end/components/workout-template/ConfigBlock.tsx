'use client';
import Badge from '@/components/ui/Badge';
import type { ExerciseConfig } from './types';
import type {
	Exercise,
	Metric,
} from '@/app/(authenticated)/workout-template/types';
import {
	metricLabels,
	metricUnits,
} from '@/app/(authenticated)/workout-template/mocks';
import { MetricField } from './MetricField';
import { RestDurationField } from './RestDurationField';
export function ConfigBlock({
	exercise,
	index,
	config,
	disabled = false,
	onChange,
}: {
	exercise: Exercise;
	index: number;
	config: ExerciseConfig;
	disabled?: boolean;
	onChange: (key: keyof ExerciseConfig, value: string | number) => void;
}) {
	const metric_1 = getMetricName(exercise.metric_1);
	const metric_2 = exercise.metric_2
		? getMetricName(exercise.metric_2)
		: undefined;

	console.log(exercise);
	return (
		<div
			data-block-index={index}
			className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5"
		>
			<div className="grid items-end gap-2 grid-cols-[28px_1fr_1fr_1fr_1fr]">
				<div className="flex items-center justify-center my-auto">
					<Badge label={`${index + 1}`} type="primary" />
				</div>
				<MetricField
					label={metric_1}
					unit={getMetricUnit(exercise.metric_1)}
					value={config.metric_1}
					onChange={(value) => onChange('metric_1', value)}
					exercise={exercise}
					disabled={disabled}
				/>
				<MetricField
					label={metric_2 ?? 'Métrica 2'}
					unit={exercise.metric_2 ? getMetricUnit(exercise.metric_2) : undefined}
					value={config.metric_2}
					type={config.metric_2_type}
					onChange={(value) => onChange('metric_2', value)}
					onTypeChange={(value) => onChange('metric_2_type', value)}
					optional={!exercise.metric_2}
					exercise={exercise}
					disabled={disabled}
				/>
				<MetricField
					label="PSE"
					unit="1–10"
					value={config.pse}
					onChange={(value) => onChange('pse', value)}
					optional
					exercise={exercise}
					disabled={disabled}
				/>
				<RestDurationField
					value={config.rest_duration}
					onChange={(seconds) => onChange('rest_duration', seconds)}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}

function getMetricName(metric: Metric): string {
	return metricLabels[metric] ?? metric;
}

function getMetricUnit(metric: Metric): string {
	return metricUnits[metric] ?? '';
}
