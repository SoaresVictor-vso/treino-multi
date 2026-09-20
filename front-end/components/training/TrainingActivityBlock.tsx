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

export default function TrainingActivityBlock({
	exercise, index, activity, onChange, onRemove,
}: {
	exercise: Exercise;
	index: number;
	activity: TrainingActivity;
	onChange: (key: keyof TrainingActivity, value: string | number) => void;
	onRemove: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [rpePickerOpen, setRpePickerOpen] = useState(false);
	return (
		<div className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5">
			<div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
				<div className="relative col-span-full flex items-center sm:col-span-1 sm:justify-center">
					<SeriesIndicator number={index + 1} completed={false} tooltip={`Abrir opções da série ${index + 1}`} onClick={() => setMenuOpen((open) => !open)} ariaExpanded={menuOpen} className={seriesTypeClassName[activity.setType]} />
					{menuOpen && (
						<div className="absolute left-0 top-full z-10 mt-1 w-52 rounded border border-outline-variant bg-surface-container p-2 shadow-xl">
							<SetTypePicker value={activity.setType} number={index + 1} onChange={(value) => { onChange('setType', value); setMenuOpen(false); }} />
							<button type="button" onClick={onRemove} className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-container/20"><RiDeleteBinLine /> Remover</button>
						</div>
					)}
				</div>
				{exercise.metric_1 && <MetricField metric={exercise.metric_1} value={activity.metric1} type={activity.type1} onChange={(value) => onChange('metric1', value)} onTypeChange={(value) => onChange('type1', value)} />}
				{exercise.metric_2 && <MetricField metric={exercise.metric_2} value={activity.metric2} type={activity.type2} onChange={(value) => onChange('metric2', value)} onTypeChange={(value) => onChange('type2', value)} allowPercent />}
				<div className="relative block min-w-0 text-xs font-semibold leading-none text-on-surface-variant">
					<span className="block truncate">RPE (opcional)</span>
					<button type="button" onClick={() => setRpePickerOpen((open) => !open)} className="mt-1 flex h-8 w-full items-center justify-between rounded-lg border border-outline-variant bg-surface-container px-3 text-sm text-on-surface"><span>{activity.pse > 0 ? `RPE ${activity.pse}` : 'Selecionar'}</span><span aria-hidden="true">⌄</span></button>
					{rpePickerOpen && <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded border border-outline-variant bg-surface-container p-2 shadow-xl"><p className="px-1 pb-2 text-xs font-semibold text-on-surface-variant">RPE prescrito</p><RpePicker value={activity.pse || null} onChange={(value) => { onChange('pse', value ?? 0); setRpePickerOpen(false); }} /></div>}
				</div>
				<RestDurationField value={activity.restDuration || 0} onChange={(value) => onChange('restDuration', value)} />
			</div>
		</div>
	);
}
