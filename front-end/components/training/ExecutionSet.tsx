'use client';

import { useState } from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import { MetricField } from '@/components/workout-template/MetricField';
import { RestDurationField } from '@/components/workout-template/RestDurationField';
import type { WorkoutExecution } from '@/api/services/workouts';

export default function ExecutionSet({ execution, number, editable, onChange, onSkip }: {
	execution: WorkoutExecution;
	number: number;
	editable: boolean;
	onChange: (key: keyof WorkoutExecution, value: number | string | null) => void;
	onSkip: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const disabled = !editable || execution.status === 'skipped' || execution.status === 'completed';
	const value = <T extends number | null>(performed: T, prescribed: T) => performed ?? prescribed ?? null;
	return (
		<div className={`rounded-lg border px-2 py-1.5 ${execution.status === 'skipped' ? 'border-outline-variant opacity-55' : execution.status === 'completed' ? 'border-primary-fixed bg-primary-container/20' : 'border-outline-variant bg-surface-container-high'}`}>
			<div className={`grid items-end gap-2 ${execution.exercise.metric_2 ? 'grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[28px_minmax(0,1fr)]'}`}>
				<div className="relative flex items-center justify-center self-center">
					<button
						type="button"
						disabled={disabled}
						onClick={() => setMenuOpen((open) => !open)}
						aria-label={`Abrir opções da série ${number}`}
						aria-expanded={menuOpen}
						className="rounded-md disabled:cursor-default"
					>
						<span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-primary-fixed-dim/20 bg-primary-fixed-dim/10 text-[11px] font-semibold text-primary-fixed-dim">
							{number}
						</span>
					</button>
					{menuOpen && !disabled && (
						<div className="absolute left-0 top-full z-10 mt-1 w-44 rounded border border-outline-variant bg-surface-container p-2 shadow-xl">
							<RestDurationField
								value={value(execution.performedRestDuration, execution.prescribedRestDuration) ?? 0}
								disabled={disabled}
								onChange={(item) => onChange('performedRestDuration', item)}
							/>
							<button
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onSkip();
								}}
								className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-container/20"
							>
								<RiDeleteBinLine /> Remover
							</button>
						</div>
					)}
				</div>
				<MetricField metric={execution.exercise.metric_1} value={value(execution.performedMetric1, execution.prescribedMetric1) ?? undefined} type="v" disabled={disabled} onTypeChange={() => {}} onChange={(item) => onChange('performedMetric1', item === '' ? null : Number(item))} />
				{execution.exercise.metric_2 && <MetricField metric={execution.exercise.metric_2} value={value(execution.performedMetric2, execution.prescribedMetric2) ?? undefined} type={execution.metric2Type ?? 'v'} allowPercent disabled={disabled} onTypeChange={() => {}} onChange={(item) => onChange('performedMetric2', item === '' ? null : Number(item))} />}
			</div>
		</div>
	);
}
