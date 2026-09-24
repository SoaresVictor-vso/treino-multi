'use client';

import { useState } from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import type { TrainingActivity } from '@/gateway/services/workouts';
import type { Exercise } from '@/gateway/services/parametro';
import { MetricField } from '@/components/workout-template/MetricField';
import { RestDurationField } from '@/components/workout-template/RestDurationField';
import SeriesIndicator, { seriesTypeClassName } from './SeriesIndicator';
import SetTypePicker from './SetTypePicker';
import RpePicker from './RpePicker';
import RpeIndicator from './RpeIndicator';
import { getVisualMetricOrder } from '@/lib/metricPresentation';

export default function TrainingActivityBlock({
	exercise, index, activity, onChange, onRemove, recordedPerformance = false,
}: {
	exercise: Exercise;
	index: number;
	activity: TrainingActivity;
	onChange: (key: keyof TrainingActivity, value: string | number) => void;
	onRemove: () => void;
	recordedPerformance?: boolean;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [rpePickerOpen, setRpePickerOpen] = useState(false);
	const visualMetrics = getVisualMetricOrder(exercise.metric_1, exercise.metric_2);
	return (
		<div className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5">
			<div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
				<div className="relative col-span-full flex items-center sm:col-span-1 sm:justify-center">
					<SeriesIndicator number={index + 1} completed={recordedPerformance} tooltip={`Abrir opções da série ${index + 1}`} onClick={() => setMenuOpen((open) => !open)} ariaExpanded={menuOpen} className={seriesTypeClassName[activity.setType]} />
					{menuOpen && (
						<div className="absolute left-0 top-full z-10 mt-1 w-52 rounded border border-outline-variant bg-surface-container p-2 shadow-xl">
							{rpePickerOpen ? (
								<>
									<button type="button" onClick={() => setRpePickerOpen(false)} className="mb-2 text-xs font-semibold text-primary-fixed-dim">← Opções da série</button>
									<p className="px-1 pb-2 text-xs font-semibold text-on-surface-variant">{recordedPerformance ? 'RPE realizado' : 'RPE prescrito'}</p>
									<RpePicker value={activity.pse || null} onChange={(value) => { onChange('pse', value ?? 0); setMenuOpen(false); setRpePickerOpen(false); }} />
								</>
							) : (
								<>
									<SetTypePicker value={activity.setType} number={index + 1} onChange={(value) => { onChange('setType', value); setMenuOpen(false); }} />
									{!activity.pse && <button type="button" onClick={() => setRpePickerOpen(true)} className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-on-surface-variant hover:bg-primary-fixed-dim/10">RPE</button>}
									<button type="button" onClick={onRemove} className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-container/20"><RiDeleteBinLine /> Remover</button>
								</>
							)}
						</div>
					)}
				</div>
				{visualMetrics.map(({ metric, key }) => <MetricField key={key} metric={metric} value={key === 1 ? activity.metric1 : activity.metric2} type={key === 1 ? activity.type1 : activity.type2} onChange={(value) => onChange(key === 1 ? 'metric1' : 'metric2', value)} onTypeChange={(value) => onChange(key === 1 ? 'type1' : 'type2', value)} allowPercent={key === 2 && !recordedPerformance} />)}
				{activity.pse > 0 ? (
					<RpeIndicator
						prescribed={recordedPerformance ? null : activity.pse}
						performed={recordedPerformance ? activity.pse : null}
						mode={recordedPerformance ? 'performed' : 'expected'}
						showComparison={false}
						onClick={() => { setRpePickerOpen(true); setMenuOpen(true); }}
					/>
				) : (
					<button
						type="button"
						onClick={() => { setRpePickerOpen(true); setMenuOpen(true); }}
						className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-outline-variant bg-surface-variant px-1.5 text-[10px] font-bold text-on-surface-variant hover:border-primary-fixed-dim hover:text-primary-fixed-dim"
						title={recordedPerformance ? 'Selecionar RPE realizado' : 'Selecionar RPE prescrito'}
					>
						RPE
					</button>
				)}
				<RestDurationField value={activity.restDuration || 0} onChange={(value) => onChange('restDuration', value)} />
			</div>
		</div>
	);
}
