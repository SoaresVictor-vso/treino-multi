'use client';
import Badge from '@/components/ui/Badge';
import {
	MetricFieldType,
	type Activity,
	type Exercise,
	type Metric,
} from '@/app/(authenticated)/workout-template/types';

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
				<MetricField
					metric={exercise.metric_1}
					value={activity.metric_1}
					type={activity.type_1}
					onChange={(value) => onChange('metric_1', value)}
					onTypeChange={(value) => onChange('type_1', value)}
					disabled={disabled}
				/>
				{exercise.metric_2 && (
					<MetricField
						metric={exercise.metric_2}
						value={activity.metric_2}
						type={activity.type_2}
						onChange={(value) => onChange('metric_2', value)}
						onTypeChange={(value) => onChange('type_2', value)}
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
					value={activity.rest_duration || 0}
					onChange={(seconds) => onChange('rest_duration', seconds)}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}
