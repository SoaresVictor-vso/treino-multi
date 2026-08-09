'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	RiAddLine,
	RiArrowLeftLine,
	RiPlayLine,
	RiSaveLine,
} from 'react-icons/ri';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Modal from '@/components/ui/Modal';
import ExercisePicker from '@/components/shared/ExercisePicker';
import PersonalRecordRequiredModal from '@/components/shared/PersonalRecordRequiredModal';
import ExecutionSet from './ExecutionSet';
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

	const updateExecution = (position: number, patch: Partial<WorkoutExecution>) =>
		setWorkout((current) =>
			current
				? {
						...current,
						executions: current.executions.map((item) =>
							item.position === position ? { ...item, ...patch } : item,
						),
					}
				: current,
		);
	const addSeries = (exercise: WorkoutExecution['exercise']) =>
		setWorkout((current) => {
			if (!current) return current;
			const position =
				Math.max(0, ...current.executions.map((item) => item.position)) + 1;
			return {
				...current,
				executions: [
					...current.executions,
					{
						id: -position,
						exerciseId: exercise.id,
						position,
						prescribedMetric1: null,
						prescribedMetric2: null,
						metric1Type: 'v',
						metric2Type: 'v',
						prescribedPse: null,
						prescribedRestDuration: null,
						performedMetric1: null,
						performedMetric2: null,
						performedPse: null,
						performedRestDuration: null,
						performedNote: null,
						status: 'in_progress',
						exercise,
						referenceGroup: null,
						referencePersonalRecord: null,
					},
				],
			};
		});
	const addExercises = (selected: Exercise[]) => {
		selected.forEach((exercise) => addSeries(exercise));
		setPickerOpen(false);
	};

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
						<article
							key={exerciseId}
							className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5"
						>
							<div className="mb-4 flex items-start justify-between gap-3">
								<div>
									<h2 className="text-xl font-bold">{sets[0].exercise.name}</h2>
									{sets[0].exercise.description && (
										<p className="mt-1 text-sm text-on-surface-variant">
											{sets[0].exercise.description}
										</p>
									)}
								</div>
								{editable && (
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												sets.forEach(
													(item) =>
														item.status === 'in_progress' &&
														updateExecution(item.position, { status: 'skipped' }),
												)
											}
										>
											Pular exercício
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => addSeries(sets[0].exercise)}
										>
											<RiAddLine /> Série
										</Button>
									</div>
								)}
							</div>
							<div className="space-y-3">
								{sets.map((execution, index) => (
									<ExecutionSet
										key={`${execution.id}-${execution.position}`}
										execution={execution}
										number={index + 1}
										editable={editable}
										onChange={(key, value) =>
											updateExecution(execution.position, {
												[key]: value,
											} as Partial<WorkoutExecution>)
										}
										onSkip={() =>
											updateExecution(execution.position, { status: 'skipped' })
										}
									/>
								))}
							</div>
						</article>
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
		</section>
	);
}
