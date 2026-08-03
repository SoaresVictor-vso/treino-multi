'use client';
import Badge from '@/components/ui/Badge';
import { type Activity } from '@/api/services/workout-templates';
import {
	MetricFieldType,
	type Exercise,
	type Metric,
} from '@/api/services/parametro';

import { MetricField } from './MetricField';
import { RestDurationField } from './RestDurationField';

const RpeMetric: Metric = {
	name: 'RPE',
	symbol: 'RPE',
	fieldType: MetricFieldType.DECIMAL,
	id: -1,
};

export function ConfigBlock({
	exercise,
	index,
	activity,
	disabled = false,
	onChange,
}: {
	exercise: Exercise;
	index: number;
	activity: Activity;
	disabled?: boolean;
	onChange: (key: keyof Activity, value: string | number) => void;
}) {
	return (
		<div
			data-block-index={index}
			className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5"
		>
			<div className="grid items-end gap-2 grid-cols-[28px_1fr_1fr_1fr_1fr]">
				<div className="flex items-center justify-center my-auto">
					<Badge label={`${index + 1}`} type="primary" />
				</div>
				{exercise.metric_1 && (
					<MetricField
						metric={exercise.metric_1}
						value={activity.metric1}
						type={activity.type1}
						onChange={(value) => onChange('metric1', value)}
						onTypeChange={(value) => onChange('type1', value)}
						disabled={disabled}
					/>
				)}
				{exercise.metric_2 && (
					<MetricField
						metric={exercise.metric_2}
						value={activity.metric2}
						type={activity.type2}
						onChange={(value) => onChange('metric2', value)}
						onTypeChange={(value) => onChange('type2', value)}
						disabled={disabled}
						allowPercent
					/>
				)}
				<MetricField
					metric={RpeMetric}
					value={activity.pse}
					onChange={(value) => onChange('pse', value)}
					onTypeChange={() => {}}
					optional
					disabled={disabled}
				/>
				<RestDurationField
					value={activity.restDuration || 0}
					onChange={(seconds) => onChange('restDuration', seconds)}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}
