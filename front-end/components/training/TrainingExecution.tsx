'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	RiAddLine,
	RiArrowLeftLine,
	RiEditLine,
	RiPlayLine,
	RiSaveLine,
} from 'react-icons/ri';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ErrorBox from '@/components/ui/ErrorBox';
import Modal from '@/components/ui/Modal';
import ExercisePicker from '@/components/shared/ExercisePicker';
import PersonalRecordRequiredModal from '@/components/shared/PersonalRecordRequiredModal';
import ExerciseReorderModal from '@/components/shared/ExerciseReorderModal';
import ExerciseExecutionCard from './ExerciseExecutionCard';
import { getSessionUser } from '@/lib/auth';
import {
	workoutsService,
	type WorkoutDetail,
	type WorkoutExecution,
} from '@/gateway/services/workouts';
import type { Exercise } from '@/gateway/services/parametro';

function serializeExecution(execution: WorkoutExecution) {
	const {
		id,
		exercise: _exercise,
		referenceGroup: _referenceGroup,
		referencePersonalRecord: _referencePersonalRecord,
		metric1Type: _metric1Type,
		metric2Type: _metric2Type,
		...payload
	} = execution;
	return { ...payload, ...(id > 0 ? { id } : {}) };
}

function statusLabel(status: WorkoutDetail['status']) {
	return {
		pending: 'Pendente',
		scheduled: 'Agendado',
		in_progress: 'Em andamento',
		completed: 'Finalizado',
		skipped: 'Pulado',
		cancelled: 'Cancelado',
	}[status];
}

function preloadPrescribedValues(workout: WorkoutDetail): WorkoutDetail {
	return {
		...workout,
		executions: workout.executions
			.toSorted((left, right) => left.position - right.position)
			.map((execution, index) => ({
				...execution,
				position: index + 1,
				performedMetric1: execution.performedMetric1 ?? execution.prescribedMetric1,
				performedMetric2: execution.performedMetric2 ?? execution.prescribedMetric2,
				performedPse: execution.performedPse ?? execution.prescribedPse,
				performedRestDuration:
					execution.performedRestDuration ?? execution.prescribedRestDuration,
			})),
	};
}

function serializeExecutions(executions: WorkoutExecution[]) {
	return executions.map((execution, index) =>
		serializeExecution({ ...execution, position: index + 1 }),
	);
}

export default function TrainingExecution({ id }: { id: string }) {
	const router = useRouter();
	const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const [saving, setSaving] = useState(false);
	const [startOpen, setStartOpen] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerSelection, setPickerSelection] = useState<Exercise[]>([]);
	const [missingRpOpen, setMissingRpOpen] = useState(false);
	const [reorderOpen, setReorderOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [workoutName, setWorkoutName] = useState('');
	const [renaming, setRenaming] = useState(false);
	const workoutRef = useRef<WorkoutDetail | null>(null);
	const saveQueueRef = useRef<WorkoutDetail | null>(null);
	const savingRef = useRef(false);

	const load = async () => {
		setLoading(true);
		const response = await workoutsService.findOne(id);
		if (!response.success || !response.data)
			setError(response.error || 'Não foi possível carregar o treino.');
		else {
			const prescribedWorkout = preloadPrescribedValues(response.data);
			workoutRef.current = prescribedWorkout;
			setWorkout(prescribedWorkout);
			setError(null);
			if (
				getSessionUser()?.sub === response.data.athleteId &&
				response.data.executions.some(
					(item) => item.metric2Type === 'p' && !item.referencePersonalRecord,
				)
			)
				setMissingRpOpen(true);
		}
		setLoading(false);
	};
	useEffect(() => {
		void Promise.resolve().then(load);
	}, [id]);

	const isAthlete = !!workout && getSessionUser()?.sub === workout.athleteId;
	const editable = isAthlete && workout?.status === 'in_progress';
	const unresolved =
		workout?.executions.some(
			(item) => !['completed', 'skipped'].includes(item.status),
		) ?? false;
	const missingRecords = useMemo(
		() =>
			(workout?.executions ?? [])
				.filter((item) => item.metric2Type === 'p' && !item.referencePersonalRecord)
				.map((item) => ({
					name: item.exercise.name,
					groupName: item.referenceGroup?.name,
				})),
		[workout],
	);
	const save = useCallback(async (snapshot = workoutRef.current) => {
		if (!snapshot) return;
		saveQueueRef.current = snapshot;
		if (savingRef.current) return;

		savingRef.current = true;
		setSaving(true);
		setError(null);
		while (saveQueueRef.current) {
			const workoutToSave = saveQueueRef.current;
			saveQueueRef.current = null;
			const response = await workoutsService.updateExecutions(
				workoutToSave.id,
				serializeExecutions(workoutToSave.executions),
				workoutToSave.exerciseNotes.map(({ exerciseId, athleteNote }) => ({
					exerciseId,
					athleteNote,
				})),
			);
			if (!response.success || !response.data) {
				setError(response.error || 'Não foi possível salvar as séries.');
				saveQueueRef.current = null;
				break;
			}
			const savedWorkout = preloadPrescribedValues(response.data);
			if (workoutRef.current === workoutToSave) {
				workoutRef.current = savedWorkout;
				setWorkout(savedWorkout);
			}
		}
		savingRef.current = false;
		setSaving(false);
	}, []);
	const updateWorkout = (updater: (current: WorkoutDetail) => WorkoutDetail) => {
		const current = workoutRef.current;
		if (!current) return;
		const updatedWorkout = updater(current);
		workoutRef.current = updatedWorkout;
		setWorkout(updatedWorkout);
		if (
			updatedWorkout.status === 'in_progress' &&
			getSessionUser()?.sub === updatedWorkout.athleteId
		)
			void save(updatedWorkout);
	};

	const updateExecution = (
		executionId: number,
		patch: Partial<WorkoutExecution>,
	) =>
		updateWorkout((current) => ({
			...current,
			executions: current.executions.map((item) =>
				item.id === executionId ? { ...item, ...patch } : item,
			),
		}));
	const updateAthleteNote = (exerciseId: number, athleteNote: string) =>
		updateWorkout((current) => {
			const existing = current.exerciseNotes.find(
				(note) => note.exerciseId === exerciseId,
			);
			return {
				...current,
				exerciseNotes: existing
					? current.exerciseNotes.map((note) =>
							note.exerciseId === exerciseId ? { ...note, athleteNote } : note,
						)
					: [
							...current.exerciseNotes,
							{ exerciseId, note: null, athleteNote },
						],
			};
		});
	const addSeries = (
		exercise: WorkoutExecution['exercise'],
		placement: 'before' | 'after',
	) =>
		updateWorkout((current) => {
			const position =
				Math.max(0, ...current.executions.map((item) => item.position)) + 1;
			const exerciseSetIndexes = current.executions
				.map((item, index) => ({ item, index }))
				.filter(
					({ item }) => item.exerciseId === exercise.id && item.status !== 'skipped',
				);
			const sourceSet =
				placement === 'before'
					? exerciseSetIndexes[0]?.item
					: exerciseSetIndexes.at(-1)?.item;
			const insertionIndex = sourceSet
				? placement === 'before'
					? exerciseSetIndexes[0].index
					: exerciseSetIndexes.at(-1)!.index + 1
				: current.executions.length;
			const executions = [...current.executions];
			executions.splice(insertionIndex, 0, {
				id: -position,
				exerciseId: exercise.id,
				position,
				prescribedMetric1: sourceSet?.prescribedMetric1 ?? null,
				prescribedMetric2: sourceSet?.prescribedMetric2 ?? null,
				metric1Type: sourceSet?.metric1Type ?? 'v',
				metric2Type: sourceSet?.metric2Type ?? 'v',
				prescribedPse: sourceSet?.prescribedPse ?? null,
				prescribedRestDuration: sourceSet?.prescribedRestDuration ?? null,
				performedMetric1: sourceSet?.performedMetric1 ?? null,
				performedMetric2: sourceSet?.performedMetric2 ?? null,
				performedPse: sourceSet?.performedPse ?? null,
				performedRestDuration: sourceSet?.performedRestDuration ?? null,
				performedNote: null,
				status: 'in_progress',
				exercise,
				referenceGroup: null,
				referencePersonalRecord: null,
			});
			return {
				...current,
				executions: executions.map((item, index) => ({
					...item,
					position: index + 1,
				})),
			};
		});
	const addExercises = (selected: Exercise[]) => {
		updateWorkout((current) => {
			const firstNewPosition = current.executions.length + 1;
			return {
				...current,
				executions: [
					...current.executions,
					...selected.map((exercise, index) => ({
						id: -(firstNewPosition + index),
						exerciseId: exercise.id,
						position: firstNewPosition + index,
						prescribedMetric1: null,
						prescribedMetric2: null,
						metric1Type: 'v' as const,
						metric2Type: 'v' as const,
						prescribedPse: null,
						prescribedRestDuration: null,
						performedMetric1: null,
						performedMetric2: null,
						performedPse: null,
						performedRestDuration: null,
						performedNote: null,
						status: 'in_progress' as const,
						exercise,
						referenceGroup: null,
						referencePersonalRecord: null,
					})),
				],
			};
		});
		setPickerOpen(false);
	};
	const reorderExercises = (exerciseIds: number[]) =>
		updateWorkout((current) => {
			const executionsByExercise = new Map<number, WorkoutExecution[]>();
			current.executions.forEach((execution) => {
				const executions = executionsByExercise.get(execution.exerciseId) ?? [];
				executions.push(execution);
				executionsByExercise.set(execution.exerciseId, executions);
			});
			const executions = exerciseIds.flatMap(
				(exerciseId) => executionsByExercise.get(exerciseId) ?? [],
			);
			return {
				...current,
				executions: executions.map((execution, index) => ({
					...execution,
					position: index + 1,
				})),
			};
		});
	const skipExercise = (executionIds: number[]) =>
		updateWorkout((current) => ({
			...current,
			executions: current.executions.map((item) =>
				executionIds.includes(item.id) && item.status === 'in_progress'
					? { ...item, status: 'skipped' }
					: item,
			),
		}));
	const reorderableExercises = Array.from(
		new Map(
			(workout?.executions ?? []).map((execution) => [
				execution.exerciseId,
				{ id: execution.exerciseId, name: execution.exercise.name },
			]),
		).values(),
	);
	const executionGroups = useMemo(() => {
		const groups = new Map<number, WorkoutExecution[]>();
		(workout?.executions ?? []).forEach((execution) => {
			const sets = groups.get(execution.exerciseId) ?? [];
			sets.push(execution);
			groups.set(execution.exerciseId, sets);
		});
		return Array.from(groups.entries());
	}, [workout?.executions]);

	const start = async () => {
		setStarting(true);
		const response = await workoutsService.start(id);
		if (!response.success || !response.data)
			setError(response.error || 'Não foi possível iniciar o treino.');
		else {
			const startedWorkout = preloadPrescribedValues(response.data);
			workoutRef.current = startedWorkout;
			setWorkout(startedWorkout);
			window.dispatchEvent(new Event('workout-status-changed'));
		}
		setStarting(false);
		setStartOpen(false);
	};
	const renameWorkout = async () => {
		if (!workout || !workoutName.trim()) return;
		setRenaming(true);
		setError(null);
		const response = await workoutsService.updateName(workout.id, workoutName.trim());
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível alterar o nome do treino.');
		} else {
			const renamedWorkout = preloadPrescribedValues(response.data);
			workoutRef.current = renamedWorkout;
			setWorkout(renamedWorkout);
			setRenameOpen(false);
		}
		setRenaming(false);
	};
	const complete = async () => {
		if (!workout) return;
		setSaving(true);
		setError(null);
		const saveResult = await workoutsService.updateExecutions(
			workout.id,
			serializeExecutions(workout.executions),
			workout.exerciseNotes.map(({ exerciseId, athleteNote }) => ({
				exerciseId,
				athleteNote,
			})),
		);
		if (!saveResult.success || !saveResult.data) {
			setError(saveResult.error || 'Não foi possível salvar as séries.');
			setSaving(false);
			return;
		}
		const result = await workoutsService.complete(workout.id);
		if (!result.success || !result.data)
			setError(result.error || 'Não foi possível finalizar o treino.');
		else {
			const completedWorkout = preloadPrescribedValues(result.data);
			workoutRef.current = completedWorkout;
			setWorkout(completedWorkout);
			window.dispatchEvent(new Event('workout-status-changed'));
		}
		setSaving(false);
	};

	if (loading)
		return (
			<p className="type-body-md text-on-surface-variant">Carregando treino...</p>
		);
	if (!workout)
		return (
			<section className="mx-auto max-w-3xl">
				<ErrorBox message={error || 'Treino não encontrado.'} />
			</section>
		);
	return (
		<section className="mx-auto w-full max-w-5xl space-y-5 pb-10">
			<div className="flex items-start justify-between gap-4">
				<div>
					<button
						type="button"
						onClick={() => router.back()}
						className="mb-3 inline-flex items-center gap-1 text-sm text-primary-fixed"
					>
						<RiArrowLeftLine /> Voltar
					</button>
					<p className="type-label-caps text-primary-fixed">Execução do treino</p>
					<div className="mt-1 flex items-center gap-2">
						<h1 className="text-3xl font-bold">{workout.templateName}</h1>
						{isAthlete && workout.status !== 'cancelled' && (
							<button
								type="button"
								onClick={() => {
									setWorkoutName(workout.templateName);
									setRenameOpen(true);
								}}
								className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg text-on-surface-variant transition hover:bg-surface-variant hover:text-primary-fixed focus:outline-none focus:ring-2 focus:ring-primary-fixed"
								aria-label="Editar nome do treino"
							>
								<RiEditLine size={18} aria-hidden />
							</button>
						)}
					</div>
					{workout.templateDescription && (
						<p className="mt-2 text-on-surface-variant">
							{workout.templateDescription}
						</p>
					)}
				</div>
				<span className="shrink-0 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">
					{statusLabel(workout.status)}
				</span>
			</div>
			{error && <ErrorBox message={error} />}
			{!isAthlete && (
				<div className="rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm text-on-surface-variant">
					Você está visualizando este treino. Apenas o atleta pode editar a execução.
				</div>
			)}
			{workout.status !== 'in_progress' &&
				workout.status !== 'completed' &&
				isAthlete && (
					<Button onClick={() => setStartOpen(true)}>
						<RiPlayLine /> Iniciar treino
					</Button>
				)}
			<div className="space-y-5">
				{executionGroups.map(([exerciseId, sets]) => {
					if (!sets.length) return null;
					return (
						<ExerciseExecutionCard
							key={exerciseId}
							sets={sets}
							exerciseNote={workout.exerciseNotes.find(
								(note) => note.exerciseId === exerciseId,
							)}
							onAthleteNoteChange={(athleteNote) =>
								updateAthleteNote(exerciseId, athleteNote)
							}
							editable={editable}
							onChange={(executionId, key, value) =>
								updateExecution(executionId, {
									[key]: value,
								} as Partial<WorkoutExecution>)
							}
							onSkipSet={(executionId) =>
								updateExecution(executionId, { status: 'skipped' })
							}
							onSkipExercise={() => skipExercise(sets.map((item) => item.id))}
							onAddWarmup={() => addSeries(sets[0].exercise, 'before')}
							onAddSeries={() => addSeries(sets[0].exercise, 'after')}
							onTitleLongPress={() => setReorderOpen(true)}
						/>
					);
				})}
			</div>
			{editable && (
				<div className="flex flex-wrap justify-end gap-3 border-t border-outline-variant pt-5">
					<Button
						variant="outline"
						onClick={() => {
							setPickerSelection([]);
							setPickerOpen(true);
						}}
					>
						<RiAddLine /> Adicionar exercício
					</Button>
					<Button variant="outline" disabled={saving} onClick={() => void save()}>
						<RiSaveLine /> Salvar alterações
					</Button>
					<Button disabled={saving || unresolved} onClick={() => void complete()}>
						{saving ? 'Salvando...' : 'Finalizar treino'}
					</Button>
				</div>
			)}
			<Modal
				isOpen={renameOpen}
				title="Editar nome do treino"
				description="Escolha um nome que facilite encontrar esta sessão depois."
				onClose={() => !renaming && setRenameOpen(false)}
			>
				<form
					className="space-y-5"
					onSubmit={(event) => {
						event.preventDefault();
						void renameWorkout();
					}}
				>
					<Input
						label="Nome do treino"
						value={workoutName}
						maxLength={100}
						autoFocus
						onChange={(event) => setWorkoutName(event.target.value)}
					/>
					<div className="flex justify-end gap-3">
						<Button variant="ghost" disabled={renaming} onClick={() => setRenameOpen(false)}>
							Cancelar
						</Button>
						<Button type="submit" disabled={renaming || !workoutName.trim()}>
							{renaming ? 'Salvando...' : 'Salvar nome'}
						</Button>
					</div>
				</form>
			</Modal>
			<Modal
				isOpen={startOpen}
				title="Iniciar treino?"
				description="Ao confirmar, o treino e suas séries passarão para em andamento."
				onClose={() => setStartOpen(false)}
			>
				<div className="flex justify-end gap-3">
					<Button variant="ghost" onClick={() => setStartOpen(false)}>
						Cancelar
					</Button>
					<Button disabled={starting} onClick={() => void start()}>
						{starting ? 'Iniciando...' : 'Confirmar início'}
					</Button>
				</div>
			</Modal>
			{pickerOpen && (
				<ExercisePicker
					selected={pickerSelection}
					onChange={setPickerSelection}
					onClose={() => void addExercises(pickerSelection)}
					filterExercise={(exercise) =>
						!(workout?.executions ?? []).some(
							(execution) => execution.exerciseId === exercise.id,
						)
					}
				/>
			)}
			<PersonalRecordRequiredModal
				isOpen={missingRpOpen}
				exercises={missingRecords}
				onClose={() => setMissingRpOpen(false)}
			/>
			<ExerciseReorderModal
				isOpen={reorderOpen}
				exercises={reorderableExercises}
				onClose={() => setReorderOpen(false)}
				onApply={reorderExercises}
			/>
		</section>
	);
}
