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
	onChange: (key: keyof Activity, value: string | number) => void;
	onRemove?: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<div
			data-block-index={index}
			className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5"
		>
			<div className="grid items-end gap-2 grid-cols-[28px_1fr_1fr_1fr_1fr]">
				<div className="relative flex items-center justify-center my-auto">
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
