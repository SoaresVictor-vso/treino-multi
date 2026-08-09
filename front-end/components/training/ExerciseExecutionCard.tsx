'use client';

import { useState } from 'react';
import { RiAddLine, RiMore2Fill, RiSkipForwardLine } from 'react-icons/ri';
import type { WorkoutExecution } from '@/api/services/workouts';
import ExecutionSet from './ExecutionSet';

type ExerciseExecutionCardProps = {
	sets: WorkoutExecution[];
	editable: boolean;
	onChange: (executionId: number, key: keyof WorkoutExecution, value: number | string | null) => void;
	onSkipSet: (executionId: number) => void;
	onSkipExercise: () => void;
	onAddWarmup: () => void;
	onAddSeries: () => void;
};

export default function ExerciseExecutionCard({ sets, editable, onChange, onSkipSet, onSkipExercise, onAddWarmup, onAddSeries }: ExerciseExecutionCardProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const visibleSets = sets.filter((set) => set.status !== 'skipped');
	if (!visibleSets.length) return null;
	const exercise = visibleSets[0].exercise;

	return (
		<article className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold">{exercise.name}</h2>
					{exercise.description && <p className="mt-1 text-sm text-on-surface-variant">{exercise.description}</p>}
				</div>
				{editable && <div className="relative shrink-0">
					<button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={`Abrir opções de ${exercise.name}`} aria-expanded={menuOpen} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary">
						<RiMore2Fill size={20} />
					</button>
					{menuOpen && <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded border border-outline-variant bg-surface-container p-1 shadow-xl">
						<button type="button" onClick={() => { setMenuOpen(false); onSkipExercise(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-error hover:bg-error-container/20">
							<RiSkipForwardLine /> Pular exercício
						</button>
					</div>}
				</div>}
			</div>
			<div className="space-y-3">
				{editable && <button type="button" onClick={onAddWarmup} className="inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"><RiAddLine /> Adicionar aquecimento</button>}
				{visibleSets.map((execution, index) => <ExecutionSet key={execution.id} execution={execution} number={index + 1} editable={editable} onChange={(key, value) => onChange(execution.id, key, value)} onSkip={() => onSkipSet(execution.id)} onStatusChange={(status) => onChange(execution.id, 'status', status)} />)}
			</div>
			{editable && <button type="button" onClick={onAddSeries} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"><RiAddLine /> Adicionar série</button>}
		</article>
	);
}
