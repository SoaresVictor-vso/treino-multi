'use client';
import { useState } from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import Badge from '@/components/ui/Badge';
import { type Activity } from '@/gateway/services/workout-templates';
import {
	MetricFieldType,
	type Exercise,
	type Metric,
} from '@/gateway/services/parametro';

import { MetricField } from './MetricField';
import { RestDurationField } from './RestDurationField';
import { getVisualMetricOrder } from '@/lib/metricPresentation';

const RpeMetric: Metric = {
	name: 'RPE',
	symbol: 'RPE',
	fieldType: MetricFieldType.DECIMAL,
	id: -1,
};

export function ActivityBlock({
	exercise,
	index,
	activity,
	disabled = false,
	onChange,
	onRemove,
}: {
	exercise: Exercise;
	index: number;
	activity: Activity;
	disabled?: boolean;
	onChange: (key: keyof Activity, value: string | number | undefined) => void;
	onRemove?: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const visualMetrics = getVisualMetricOrder(exercise.metric_1, exercise.metric_2);

	return (
		<div
			data-block-index={index}
			className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5"
		>
			<div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
				<div className="relative col-span-full flex items-center sm:col-span-1 sm:justify-center">
					<button
						type="button"
						disabled={disabled}
						onClick={() => setMenuOpen((open) => !open)}
						aria-label={`Abrir opções do bloco ${index + 1}`}
						aria-expanded={menuOpen}
						className="rounded-md disabled:cursor-default"
					>
						<Badge label={`${index + 1}`} type="primary" />
					</button>
					{menuOpen && !disabled && (
						<div className="absolute left-0 top-full z-10 mt-1 w-32 rounded border border-outline-variant bg-surface-container p-1 shadow-xl">
							<button
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onRemove?.();
								}}
								className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-error hover:bg-error-container/20"
							>
								<RiDeleteBinLine /> Remover
							</button>
						</div>
					)}
				</div>
				{visualMetrics.map(({ metric, key }) => (
					<MetricField
						key={key}
						metric={metric}
						value={key === 1 ? activity.metric1 : activity.metric2}
						type={key === 1 ? activity.type1 : activity.type2}
						onChange={(value) =>
							key === 1
								? onChange('metric1', value)
								: onChange('metric2', value === '' ? undefined : value)
						}
						onTypeChange={(value) => onChange(key === 1 ? 'type1' : 'type2', value)}
						disabled={disabled}
						allowPercent={key === 2}
					/>
				))}
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
