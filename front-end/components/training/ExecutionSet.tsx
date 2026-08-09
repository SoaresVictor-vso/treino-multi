'use client';

import { useState, type PointerEvent } from 'react';
import { RiArrowGoBackLine, RiCheckLine, RiDeleteBinLine } from 'react-icons/ri';
import { MetricField } from '@/components/workout-template/MetricField';
import { RestDurationField } from '@/components/workout-template/RestDurationField';
import type { ExecutionStatus, WorkoutExecution } from '@/api/services/workouts';

const SWIPE_THRESHOLD = 72;

export default function ExecutionSet({ execution, number, editable, onChange, onSkip, onStatusChange }: {
	execution: WorkoutExecution;
	number: number;
	editable: boolean;
	onChange: (key: keyof WorkoutExecution, value: number | string | null) => void;
	onSkip: () => void;
	onStatusChange: (status: ExecutionStatus) => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [dragStartX, setDragStartX] = useState<number | null>(null);
	const [dragOffset, setDragOffset] = useState(0);
	const locked = !editable || execution.status === 'skipped';
	const fieldsDisabled = locked || execution.status === 'completed';
	const value = <T extends number | null>(performed: T, prescribed: T) => performed ?? prescribed ?? null;
	const hasRequiredMetrics =
		value(execution.performedMetric1, execution.prescribedMetric1) !== null &&
		(!execution.exercise.metric_2 ||
			value(execution.performedMetric2, execution.prescribedMetric2) !== null);
	const canComplete =
		editable && execution.status === 'in_progress' && hasRequiredMetrics;
	const canUndo = editable && execution.status === 'completed';
	const draggable = canComplete || canUndo;
	const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStartX === null) return;
		const offset = event.clientX - dragStartX;
		if (canComplete && offset >= SWIPE_THRESHOLD) onStatusChange('completed');
		if (canUndo && offset <= -SWIPE_THRESHOLD) onStatusChange('in_progress');
		setDragStartX(null);
		setDragOffset(0);
	};

	return (
		<div className="relative overflow-hidden rounded-lg">
			<div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-green-600 text-white" aria-hidden="true">
				<RiCheckLine size={25} />
			</div>
			<div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-secondary-container text-on-secondary-container" aria-hidden="true">
				<RiArrowGoBackLine size={22} />
			</div>
			<div
				className={`relative touch-pan-y rounded-lg border px-2 py-1.5 ${dragStartX === null ? 'transition-transform duration-200' : ''} ${execution.status === 'completed' ? 'border-outline-variant bg-surface-variant' : 'border-outline-variant bg-surface-container-high'}`}
				style={{ transform: `translateX(${dragOffset}px)` }}
				onPointerDown={(event) => {
					if (!draggable) return;
					setDragStartX(event.clientX);
					event.currentTarget.setPointerCapture(event.pointerId);
				}}
				onPointerMove={(event) => {
					if (dragStartX === null) return;
					const offset = event.clientX - dragStartX;
					setDragOffset(
						canComplete
							? Math.max(0, Math.min(96, offset))
							: Math.min(0, Math.max(-96, offset)),
					);
				}}
				onPointerUp={finishDrag}
				onPointerCancel={() => { setDragStartX(null); setDragOffset(0); }}
			>
				<div className={`grid items-end gap-2 ${execution.exercise.metric_2 ? 'grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[28px_minmax(0,1fr)]'}`}>
					<div className="relative flex items-center justify-center self-center">
						<button type="button" disabled={fieldsDisabled} onClick={() => setMenuOpen((open) => !open)} aria-label={`Abrir opções da série ${number}`} aria-expanded={menuOpen} className="rounded-md disabled:cursor-default">
							<span
								className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${
									execution.status === 'completed'
										? 'border-primary-fixed-dim bg-primary-fixed-dim text-on-primary-fixed'
										: 'border-primary-fixed-dim/20 bg-primary-fixed-dim/10 text-primary-fixed-dim'
								}`}
							>
								{number}
							</span>
						</button>
						{menuOpen && !fieldsDisabled && <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded border border-outline-variant bg-surface-container p-2 shadow-xl">
							<RestDurationField value={value(execution.performedRestDuration, execution.prescribedRestDuration) ?? 0} disabled={fieldsDisabled} onChange={(item) => onChange('performedRestDuration', item)} />
							<button type="button" onClick={() => { setMenuOpen(false); onSkip(); }} className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-container/20"><RiDeleteBinLine /> Remover</button>
						</div>}
					</div>
					<MetricField metric={execution.exercise.metric_1} value={value(execution.performedMetric1, execution.prescribedMetric1) ?? undefined} type="v" disabled={fieldsDisabled} onTypeChange={() => {}} onChange={(item) => onChange('performedMetric1', item === '' ? null : Number(item))} />
					{execution.exercise.metric_2 && <MetricField metric={execution.exercise.metric_2} value={value(execution.performedMetric2, execution.prescribedMetric2) ?? undefined} type={execution.metric2Type ?? 'v'} allowPercent disabled={fieldsDisabled} onTypeChange={() => {}} onChange={(item) => onChange('performedMetric2', item === '' ? null : Number(item))} />}
				</div>
				{execution.status === 'completed' && (
					<div
						className="pointer-events-none absolute inset-0 rounded-lg bg-black/25"
						aria-hidden="true"
					/>
				)}
			</div>
		</div>
	);
}
