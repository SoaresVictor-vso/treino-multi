'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiArrowLeftLine, RiPlayLine, RiSaveLine } from 'react-icons/ri';
import Link from 'next/link';
import Button from '@/components/ui/Button';
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
} from '@/api/services/workouts';
import type { Exercise } from '@/api/services/parametro';

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
		executions: workout.executions.map((execution) => ({
			...execution,
			performedMetric1: execution.performedMetric1 ?? execution.prescribedMetric1,
			performedMetric2: execution.performedMetric2 ?? execution.prescribedMetric2,
			performedPse: execution.performedPse ?? execution.prescribedPse,
			performedRestDuration:
				execution.performedRestDuration ?? execution.prescribedRestDuration,
		})),
	};
}

export default function TrainingExecution({ id }: { id: string }) {
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

	const load = async () => {
		setLoading(true);
		const response = await workoutsService.findOne(id);
		if (!response.success || !response.data)
			setError(response.error || 'Não foi possível carregar o treino.');
		else {
			const prescribedWorkout = preloadPrescribedValues(response.data);
			setWorkout(prescribedWorkout);
			setError(null);
			if (
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

	const updateExecution = (executionId: number, patch: Partial<WorkoutExecution>) =>
		setWorkout((current) =>
			current
				? {
						...current,
						executions: current.executions.map((item) =>
						item.id === executionId ? { ...item, ...patch } : item,
						),
					}
				: current,
		);
	const addSeries = (
		exercise: WorkoutExecution['exercise'],
		placement: 'before' | 'after',
	) =>
		setWorkout((current) => {
			if (!current) return current;
			const position = Math.max(0, ...current.executions.map((item) => item.position)) + 1;
			const exerciseSetIndexes = current.executions
				.map((item, index) => ({ item, index }))
				.filter(({ item }) => item.exerciseId === exercise.id && item.status !== 'skipped');
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
		selected.forEach((exercise) => addSeries(exercise, 'after'));
		setPickerOpen(false);
	};
	const reorderExercises = (exerciseIds: number[]) =>
		setWorkout((current) => {
			if (!current) return current;
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
	const reorderableExercises = Array.from(
		new Map(
			(workout?.executions ?? []).map((execution) => [
				execution.exerciseId,
				{ id: execution.exerciseId, name: execution.exercise.name },
			]),
		).values(),
	);

	const save = async () => {
		if (!workout) return;
		setSaving(true);
		setError(null);
		const response = await workoutsService.updateExecutions(
			workout.id,
			workout.executions.map(serializeExecution),
		);
		if (!response.success || !response.data)
			setError(response.error || 'Não foi possível salvar as séries.');
		else setWorkout(preloadPrescribedValues(response.data));
		setSaving(false);
	};
	const start = async () => {
		setStarting(true);
		const response = await workoutsService.start(id);
		if (!response.success || !response.data)
			setError(response.error || 'Não foi possível iniciar o treino.');
		else setWorkout(preloadPrescribedValues(response.data));
		setStarting(false);
		setStartOpen(false);
	};
	const complete = async () => {
		if (!workout) return;
		setSaving(true);
		setError(null);
		const saveResult = await workoutsService.updateExecutions(
			workout.id,
			workout.executions.map(serializeExecution),
		);
		if (!saveResult.success || !saveResult.data) {
			setError(saveResult.error || 'Não foi possível salvar as séries.');
			setSaving(false);
			return;
		}
		const result = await workoutsService.complete(workout.id);
		if (!result.success || !result.data)
			setError(result.error || 'Não foi possível finalizar o treino.');
		else setWorkout(preloadPrescribedValues(result.data));
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
					<Link
						href="/home"
						className="mb-3 inline-flex items-center gap-1 text-sm text-primary-fixed"
					>
						<RiArrowLeftLine /> Voltar
					</Link>
					<p className="type-label-caps text-primary-fixed">Execução do treino</p>
					<h1 className="mt-1 text-3xl font-bold">{workout.templateName}</h1>
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
				{Object.entries(
					Object.groupBy(workout.executions, (item) => item.exerciseId),
				).map(([exerciseId, groupedSets]) => {
					const sets = groupedSets ?? [];
					if (!sets.length) return null;
					return (
						<ExerciseExecutionCard
							key={exerciseId}
							sets={sets}
							editable={editable}
							onChange={(executionId, key, value) =>
								updateExecution(executionId, { [key]: value } as Partial<WorkoutExecution>)
							}
							onSkipSet={(executionId) => updateExecution(executionId, { status: 'skipped' })}
							onSkipExercise={() => sets.forEach((item) => {
								if (item.status === 'in_progress') updateExecution(item.id, { status: 'skipped' });
							})}
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
