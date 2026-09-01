'use client';

import { useEffect, useRef, useState } from 'react';
import { RiAddLine, RiMore2Fill, RiSkipForwardLine } from 'react-icons/ri';
import Textarea from '@/components/ui/Textarea';
import type {
	WorkoutExecution,
	WorkoutExerciseNote,
} from '@/gateway/services/workouts';
import ExecutionSet from './ExecutionSet';

type ExerciseExecutionCardProps = {
	sets: WorkoutExecution[];
	editable: boolean;
	onChange: (
		executionId: number,
		key: keyof WorkoutExecution,
		value: number | string | null,
	) => void;
	onSkipSet: (executionId: number) => void;
	onSkipExercise: () => void;
	onAddWarmup: () => void;
	onAddSeries: () => void;
	onTitleLongPress?: () => void;
	exerciseNote?: WorkoutExerciseNote;
	onAthleteNoteChange: (note: string) => void;
};

export default function ExerciseExecutionCard({
	sets,
	editable,
	onChange,
	onSkipSet,
	onSkipExercise,
	onAddWarmup,
	onAddSeries,
	onTitleLongPress,
	exerciseNote,
	onAthleteNoteChange,
}: ExerciseExecutionCardProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [noteOpen, setNoteOpen] = useState(false);
	const reorderPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelReorderPress = () => {
		if (reorderPressTimer.current) clearTimeout(reorderPressTimer.current);
		reorderPressTimer.current = null;
	};
	const startReorderPress = () => {
		if (!editable || !onTitleLongPress) return;
		cancelReorderPress();
		reorderPressTimer.current = setTimeout(() => {
			onTitleLongPress();
			reorderPressTimer.current = null;
		}, 1000);
	};
	const startTouchReorderPress = (event: React.TouchEvent) => {
		event.preventDefault();
		startReorderPress();
	};
	useEffect(() => cancelReorderPress, []);
	const visibleSets = sets.filter((set) => set.status !== 'skipped');
	if (!visibleSets.length) return null;
	const exercise = visibleSets[0].exercise;
	const trainerNote = exerciseNote?.note;
	const athleteNote = exerciseNote?.athleteNote;

	return (
		<article className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2
						className={`text-xl font-bold ${editable ? 'cursor-pointer select-none touch-manipulation' : ''}`}
						onPointerDown={startReorderPress}
						onPointerUp={cancelReorderPress}
						onPointerLeave={cancelReorderPress}
						onPointerCancel={cancelReorderPress}
						onTouchStart={startTouchReorderPress}
						onTouchEnd={cancelReorderPress}
						onTouchCancel={cancelReorderPress}
						onContextMenu={(event) => event.preventDefault()}
					>
						{exercise.name}
					</h2>
					{exercise.description && (
						<p className="mt-1 text-sm text-on-surface-variant">
							{exercise.description}
						</p>
					)}
				</div>
				{editable && (
					<div className="relative shrink-0">
						<button
							type="button"
							onClick={() => setMenuOpen((open) => !open)}
							aria-label={`Abrir opções de ${exercise.name}`}
							aria-expanded={menuOpen}
							className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary"
						>
							<RiMore2Fill size={20} />
						</button>
						{menuOpen && (
							<div className="absolute right-0 top-full z-10 mt-1 w-48 rounded border border-outline-variant bg-surface-container p-1 shadow-xl">
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										if (athleteNote) {
											onAthleteNoteChange('');
											setNoteOpen(false);
										} else setNoteOpen(true);
									}}
									className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-surface-variant"
								>
									{athleteNote ? 'Remover minha nota' : 'Criar minha nota'}
								</button>
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										onSkipExercise();
									}}
									className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-error hover:bg-error-container/20"
								>
									<RiSkipForwardLine /> Pular exercício
								</button>
							</div>
						)}
					</div>
				)}
			</div>
			{trainerNote && (
				<div className="mb-4 rounded-lg border border-white p-3 text-sm text-on-surface">
					<p className="font-semibold">Nota do treinador</p>
					<p className="mt-1 whitespace-pre-wrap">{trainerNote}</p>
				</div>
			)}
			{editable && (noteOpen || athleteNote) ? (
				<div className="mb-4">
					<Textarea
						label="Sua nota (opcional)"
						value={athleteNote ?? ''}
						maxLength={2000}
						onChange={(event) => onAthleteNoteChange(event.target.value)}
						placeholder="Registre como foi a execução deste exercício"
						rows={2}
					/>
				</div>
			) : athleteNote ? (
				<div className="mb-4 rounded-lg bg-surface-container-high p-3 text-sm text-on-surface-variant">
					<p className="font-semibold text-on-surface">Nota do atleta</p>
					<p className="mt-1 whitespace-pre-wrap">{athleteNote}</p>
				</div>
			) : null}
			<div className="space-y-3">
				{editable && (
					<button
						type="button"
						onClick={onAddWarmup}
						className="inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
					>
						<RiAddLine /> Adicionar aquecimento
					</button>
				)}
				{visibleSets.map((execution, index) => (
					<ExecutionSet
						key={execution.id}
						execution={execution}
						number={index + 1}
						editable={editable}
						onChange={(key, value) => onChange(execution.id, key, value)}
						onSkip={() => onSkipSet(execution.id)}
						onStatusChange={(status) => onChange(execution.id, 'status', status)}
					/>
				))}
			</div>
			{editable && (
				<button
					type="button"
					onClick={onAddSeries}
					className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
				>
					<RiAddLine /> Adicionar série
				</button>
			)}
		</article>
	);
}
