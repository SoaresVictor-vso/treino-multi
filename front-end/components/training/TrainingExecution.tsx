'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	RiAddLine,
	RiArrowLeftLine,
	RiCheckLine,
	RiEditLine,
	RiExternalLinkLine,
	RiPlayLine,
} from 'react-icons/ri';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
import ErrorBox from '@/components/ui/ErrorBox';
import Modal from '@/components/ui/Modal';
import ExercisePicker from '@/components/shared/ExercisePicker';
import ExerciseHistorySeriesList from '@/components/shared/ExerciseHistorySeriesList';
import PersonalRecordRequiredModal from '@/components/shared/PersonalRecordRequiredModal';
import ExerciseReorderModal from '@/components/shared/ExerciseReorderModal';
import ExerciseExecutionCard from './ExerciseExecutionCard';
import WorkoutComparison from './WorkoutComparison';
import { isRepetitionsMetric } from '@/lib/metricPresentation';
import {
	completionMessages,
	default as WorkoutCompletionScreen,
} from './WorkoutCompletionScreen';
import WorkoutMeasurements from './WorkoutMeasurements';
import { preliminaryMeasurements } from './preliminaryMeasurements';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@/lib/roles';
import {
	createConfirmedWorkout,
	readCurrentWorkout,
	readPendingWorkout,
	updatePendingWorkout,
	waitForPendingWorkoutWrites,
	readConfirmedWorkout,
	syncPendingWorkouts,
	resolveWorkoutConflict,
	syncSingleWorkoutSource,
	pullWorkouts,
	recordWorkoutConflict,
	readTrainerReview,
	acknowledgeTrainerReview,
} from '@/lib/offline-contingency';
import {
	workoutsService,
	type WorkoutDetail,
	type WorkoutExecution,
} from '@/gateway/services/workouts';
import { exerciseReviewsService } from '@/gateway/services/exercise-reviews';
import type { Exercise } from '@/gateway/services/parametro';
import {
	DEFAULT_REST_DURATION,
	WORKOUT_REFRESH_INTERVAL,
} from '@/lib/constants';

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
			.map((execution, index) => {
				const prescribedRestDuration =
					execution.prescribedRestDuration || DEFAULT_REST_DURATION;
				return {
					...execution,
					position: index + 1,
					status:
						workout.status === 'in_progress' && execution.status === 'pending'
							? 'in_progress'
							: execution.status,
					prescribedRestDuration,
					performedMetric1:
						execution.performedMetric1 ?? execution.prescribedMetric1,
					performedMetric2:
						execution.performedMetric2 ?? execution.prescribedMetric2,
					performedRestDuration:
						execution.performedRestDuration || prescribedRestDuration,
				};
			}),
	};
}

export default function TrainingExecution({ id }: { id: string }) {
	const router = useRouter();
	const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [conflict, setConflict] = useState<WorkoutDetail | null>(null);
	const [trainerReview, setTrainerReview] = useState<WorkoutExecution[]>([]);
	const [starting, setStarting] = useState(false);
	const [saving, setSaving] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [completionOpen, setCompletionOpen] = useState(false);
	const [showPostCompletion, setShowPostCompletion] = useState(false);
	const [completionMessage, setCompletionMessage] = useState('');
	const [startOpen, setStartOpen] = useState(false);
	const [skipOpen, setSkipOpen] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerSelection, setPickerSelection] = useState<Exercise[]>([]);
	const [missingRpOpen, setMissingRpOpen] = useState(false);
	const [reorderOpen, setReorderOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [restOpen, setRestOpen] = useState(false);
	const [restExecution, setRestExecution] = useState<WorkoutExecution | null>(
		null,
	);
	const [restSeconds, setRestSeconds] = useState(0);
	const [applyRestToExercise, setApplyRestToExercise] = useState(false);
	const [applyRestToWorkout, setApplyRestToWorkout] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const [restDismissed, setRestDismissed] = useState(false);
	const [workoutName, setWorkoutName] = useState('');
	const [renaming, setRenaming] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [exerciseHistory, setExerciseHistory] = useState<{
		name: string;
		id: number;
		metric1Label: string;
		metric2Label: string | null;
		rows: Array<{
			workoutName: string;
			performedAt: string;
			metric1: number | null;
			metric2: number | null;
			predictedRm: number | null;
			setType: string;
			note: string | null;
		}> | null;
	} | null>(null);
	const workoutRef = useRef<WorkoutDetail | null>(null);
	const savingRef = useRef(false);
	const dirtyRef = useRef(false);
	const exerciseHistoryCacheRef = useRef<
		Map<string, NonNullable<typeof exerciseHistory>['rows']>
	>(new Map());

	const openExerciseHistory = (
		exerciseId: number,
		execution: WorkoutExecution,
	) => {
		if (!workout) return;

		const cacheKey = `${workout.athleteId}:${exerciseId}`;
		const cachedRows = exerciseHistoryCacheRef.current.get(cacheKey);
		const history = {
			name: execution.exercise.name,
			id: exerciseId,
			metric1Label: `${(isRepetitionsMetric(execution.exercise.metric_1) && execution.exercise.metric_2 ? execution.exercise.metric_2 : execution.exercise.metric_1).name} (${(isRepetitionsMetric(execution.exercise.metric_1) && execution.exercise.metric_2 ? execution.exercise.metric_2 : execution.exercise.metric_1).symbol})`,
			metric2Label: isRepetitionsMetric(execution.exercise.metric_1)
				? `${execution.exercise.metric_1.name} (${execution.exercise.metric_1.symbol})`
				: execution.exercise.metric_2
					? `${execution.exercise.metric_2.name} (${execution.exercise.metric_2.symbol})`
					: null,
			rows: cachedRows ?? null,
		};

		setHistoryOpen(true);
		setExerciseHistory(history);
		if (cachedRows !== undefined) return;

		void exerciseReviewsService
			.latest(workout.athleteId, exerciseId)
			.then((response) => {
				const rows = response.data?.item ?? [];
				if (response.success) exerciseHistoryCacheRef.current.set(cacheKey, rows);
				setExerciseHistory((previous) =>
					previous?.id === exerciseId ? { ...previous, rows } : previous,
				);
			});
	};

	const load = useCallback(
		async (background = false) => {
			if (!background) setLoading(true);
			const userId = getSessionUser()?.sub;
			if (userId) {
				try {
					await waitForPendingWorkoutWrites(userId, id);
					const local = await readCurrentWorkout(userId, id);
					setConflict(local?.conflict ?? null);
					if (local?.workout.status === 'completed') setTrainerReview(await readTrainerReview(userId, id));
					if (local && local.workout.athleteId === userId && (!local.synchronized || !navigator.onLine)) {
						const localWorkout = preloadPrescribedValues(local.workout);
						workoutRef.current = localWorkout;
						setWorkout(localWorkout);
						setHasUnsavedChanges(!local.synchronized);
						dirtyRef.current = !local.synchronized;
						setError(null);
						if (!background) setLoading(false);
						return;
					}
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : 'Falha ao ler o treino local.');
				}
			}
			if (userId && navigator.onLine && getSessionUser()?.roles.includes(Role.TENANT_CLIENT) && !(await readCurrentWorkout(userId, id))) {
				try { await pullWorkouts(userId); }
				catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao sincronizar treino.'); }
			}
			if (userId && navigator.onLine && !getSessionUser()?.roles.includes(Role.TENANT_CLIENT)) {
				try { await syncSingleWorkoutSource(userId, id); }
				catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao sincronizar treino.'); }
			}
			const response = await workoutsService.findOne(id);
			if (!response.success || !response.data)
				setError(response.error || 'Não foi possível carregar o treino.');
			else {
				const prescribedWorkout = preloadPrescribedValues(response.data);
				setError(null);
				if (userId === response.data.athleteId) {
					try { await createConfirmedWorkout(userId, response.data); }
					catch { setError('Não foi possível guardar o treino neste dispositivo.'); }
				}
				workoutRef.current = prescribedWorkout;
				setWorkout(prescribedWorkout);
				if (
					getSessionUser()?.sub === response.data.athleteId &&
					response.data.executions.some(
						(item) => item.metric2Type === 'p' && !item.referencePersonalRecord,
					)
				)
					setMissingRpOpen(true);
			}
			if (!background) setLoading(false);
		},
		[id],
	);
	useEffect(() => {
		void Promise.resolve().then(() => load());
	}, [load]);

	const isAthlete = !!workout && getSessionUser()?.sub === workout.athleteId;
	useEffect(() => {
		if (isAthlete || workout?.status !== 'in_progress') return;
		const refresh = window.setInterval(
			() => void load(true),
			WORKOUT_REFRESH_INTERVAL,
		);
		return () => window.clearInterval(refresh);
	}, [isAthlete, load, workout?.status]);
	const editable = isAthlete && workout?.status === 'in_progress';
	const structuralEditable = editable && workout?.createdBy === getSessionUser()?.sub;
	const unresolved =
		workout?.executions.some(
			(item) =>
				!item.pendingRemoval && !['completed', 'skipped'].includes(item.status),
		) ?? false;
	const missingRecords = useMemo(
		() =>
			(workout?.executions ?? [])
				.filter(
					(item) =>
						!item.pendingRemoval &&
						item.metric2Type === 'p' &&
						!item.referencePersonalRecord,
				)
				.map((item) => ({
					name: item.exercise.name,
					groupName: item.referenceGroup?.name,
				})),
		[workout],
	);
	const save = useCallback(async (snapshot = workoutRef.current) => {
		if (!snapshot || savingRef.current) return;
		const userId = getSessionUser()?.sub;
		if (!userId || userId !== snapshot.athleteId) return;

		savingRef.current = true;
		setSaving(true);
		setError(null);
		let pending;
		try {
			await waitForPendingWorkoutWrites(userId, snapshot.id);
			pending = await readPendingWorkout(userId, snapshot.id);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Falha ao ler alterações locais.');
			savingRef.current = false;
			setSaving(false);
			return;
		}
		if (!pending || (typeof navigator !== 'undefined' && !navigator.onLine)) {
			savingRef.current = false;
			setSaving(false);
			return;
		}
		try {
			const result = await syncPendingWorkouts(userId, { workoutId: snapshot.id });
			const latestPending = await readPendingWorkout(userId, snapshot.id);
			setConflict(latestPending?.conflict ?? null);
			const latest = latestPending ?? await readConfirmedWorkout(userId, snapshot.id);
			if (latest) {
				const visible = preloadPrescribedValues(latest.workout);
				workoutRef.current = visible;
				setWorkout(visible);
				dirtyRef.current = !!latestPending;
				setHasUnsavedChanges(!!latestPending);
			}
			if (result.errors.length) setError(result.errors.join(' '));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Não foi possível sincronizar.');
		}
		savingRef.current = false;
		setSaving(false);
	}, []);
	useEffect(() => {
		const onConflict = (event: Event) => {
			if ((event as CustomEvent<{ workoutId: string }>).detail?.workoutId !== id) return;
			const userId = getSessionUser()?.sub;
			if (userId) void readPendingWorkout(userId, id).then((row) => setConflict(row?.conflict ?? null));
		};
		window.addEventListener('workout-sync-conflict', onConflict);
		const onTrainerReconciled = (event: Event) => {
			if ((event as CustomEvent<{ workoutId: string }>).detail?.workoutId === id) void load(true);
		};
		window.addEventListener('workout-trainer-reconciled', onTrainerReconciled);
		const onCopied = (event: Event) => {
			const detail = (event as CustomEvent<{ originalId: string; copyId: string }>).detail;
			if (detail?.originalId === id) router.replace(`/training/${detail.copyId}`);
		};
		window.addEventListener('workout-sync-copy', onCopied);
		return () => {
			window.removeEventListener('workout-sync-conflict', onConflict);
			window.removeEventListener('workout-trainer-reconciled', onTrainerReconciled);
			window.removeEventListener('workout-sync-copy', onCopied);
		};
	}, [id, load, router]);
	const chooseConflict = async (choice: 'current' | 'saved' | 'both') => {
		const userId = getSessionUser()?.sub;
		if (!userId || !workout) return;
		try {
			await resolveWorkoutConflict(userId, workout.id, choice);
			setConflict(null);
			if (choice === 'current') {
				const saved = await readCurrentWorkout(userId, workout.id);
				if (saved) { workoutRef.current = saved.workout; setWorkout(saved.workout); setHasUnsavedChanges(false); dirtyRef.current = false; }
			} else {
				const result = await syncPendingWorkouts(userId, { workoutId: workout.id });
				if (result.errors.length) setError(result.errors.join(' '));
				const latest = await readCurrentWorkout(userId, workout.id);
				if (latest) { workoutRef.current = latest.workout; setWorkout(latest.workout); setHasUnsavedChanges(!latest.synchronized); dirtyRef.current = !latest.synchronized; }
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Falha ao resolver o conflito.');
		}
	};
	useEffect(() => {
		const autosave = window.setInterval(() => {
			const userId = getSessionUser()?.sub;
			if (!userId || workoutRef.current?.status !== 'in_progress' || !navigator.onLine) return;
			void pullWorkouts(userId).then(async () => {
				const current = workoutRef.current;
				const confirmed = current && await readConfirmedWorkout(userId, current.id);
				if (current && confirmed?.workout.status === 'completed') {
					if (!(await readPendingWorkout(userId, current.id))) await updatePendingWorkout(userId, current);
					await recordWorkoutConflict(userId, current.id, confirmed.workout);
					setConflict(confirmed.workout);
					return;
				}
				if (dirtyRef.current) await save();
				else await load(true);
			}).catch((cause) => setError(cause instanceof Error ? cause.message : 'Falha na sincronização do treino.'));
		}, 60_000);
		return () => window.clearInterval(autosave);
	}, [save, load]);
	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, []);

	const updateWorkout = (updater: (current: WorkoutDetail) => WorkoutDetail) => {
		const current = workoutRef.current;
		if (!current) return;
		const updatedWorkout = updater(current);
		workoutRef.current = updatedWorkout;
		setWorkout(updatedWorkout);
		dirtyRef.current = true;
		setHasUnsavedChanges(true);
		const userId = getSessionUser()?.sub;
		if (userId === updatedWorkout.athleteId)
			void updatePendingWorkout(userId, updatedWorkout).catch((cause) =>
				setError(cause instanceof Error ? cause.message : 'Falha ao salvar alterações no dispositivo.'),
			);
	};

	const updateExecution = (
		executionId: number,
		patch: Partial<WorkoutExecution>,
	) => {
		const currentExecution = workoutRef.current?.executions.find(
			(item) => item.id === executionId,
		);
		if (
			patch.status === 'in_progress' &&
			currentExecution?.status === 'completed'
		)
			setRestDismissed(true);
		if (patch.status === 'completed') setRestDismissed(false);
		updateWorkout((current) => ({
			...current,
			executions: current.executions.map((item) =>
				item.id === executionId
					? {
							...item,
							...patch,
							...(patch.status === 'completed'
								? { startedAt: item.startedAt ?? new Date().toISOString(), finishedAt: new Date().toISOString() }
								: {}),
							...(patch.status === 'in_progress' ? { finishedAt: null } : {}),
							...(patch.status === 'in_progress' && !item.startedAt ? { startedAt: new Date().toISOString() } : {}),
						}
					: item,
			),
		}));
	};
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
					: [...current.exerciseNotes, { exerciseId, note: null, athleteNote }],
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
				id: Math.min(0, ...current.executions.map((item) => item.id)) - 1,
				exerciseId: exercise.id,
				position,
				prescribedMetric1: sourceSet?.prescribedMetric1 ?? null,
				prescribedMetric2: sourceSet?.prescribedMetric2 ?? null,
				metric1Type: sourceSet?.metric1Type ?? 'v',
				metric2Type: sourceSet?.metric2Type ?? 'v',
				prescribedPse: sourceSet?.prescribedPse ?? null,
				prescribedRestDuration:
					sourceSet?.prescribedRestDuration ?? DEFAULT_REST_DURATION,
				performedMetric1: sourceSet?.performedMetric1 ?? null,
				performedMetric2: sourceSet?.performedMetric2 ?? null,
				performedPse: sourceSet?.performedPse ?? null,
				performedRestDuration:
					sourceSet?.performedRestDuration ?? DEFAULT_REST_DURATION,
				performedNote: null,
				setType:
					placement === 'before' ? 'aquecimento' : (sourceSet?.setType ?? 'padrao'),
				finishedAt: null,
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
			const existingExerciseIds = new Set(
				current.executions.map((execution) => execution.exerciseId),
			);
			const newExercises = selected.filter(
				(exercise) => !existingExerciseIds.has(exercise.id),
			);
			if (!newExercises.length) return current;
			const firstNewPosition = current.executions.length + 1;
			const activeRestDurations = current.executions
				.filter((execution) => execution.status !== 'skipped')
				.map(
					(execution) =>
						execution.performedRestDuration ||
						execution.prescribedRestDuration ||
						DEFAULT_REST_DURATION,
				);
			const restDuration =
				activeRestDurations.length > 0 &&
				activeRestDurations.every((duration) => duration === activeRestDurations[0])
					? activeRestDurations[0]
					: DEFAULT_REST_DURATION;
			const previousSetType =
				current.executions
					.filter((execution) => execution.status !== 'skipped')
					.toSorted((left, right) => left.position - right.position)
					.at(-1)?.setType ?? 'padrao';
			return {
				...current,
				executions: [
					...current.executions,
					...newExercises.map((exercise, index) => ({
						id: Math.min(0, ...current.executions.map((item) => item.id)) - index - 1,
						exerciseId: exercise.id,
						position: firstNewPosition + index,
						prescribedMetric1: null,
						prescribedMetric2: null,
						metric1Type: 'v' as const,
						metric2Type: 'v' as const,
						prescribedPse: null,
						prescribedRestDuration: restDuration,
						performedMetric1: null,
						performedMetric2: null,
						performedPse: null,
						performedRestDuration: restDuration,
						performedNote: null,
						setType: previousSetType,
						finishedAt: null,
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
	const openExercisePicker = () => {
		const exercisesById = new Map<number, Exercise>();
		(workoutRef.current?.executions ?? []).forEach((execution) => {
			if (!exercisesById.has(execution.exerciseId))
				exercisesById.set(execution.exerciseId, execution.exercise);
		});
		setPickerSelection(Array.from(exercisesById.values()));
		setPickerOpen(true);
	};
	const reorderExercises = (exerciseIds: number[]) =>
		updateWorkout((current) => {
			const executionsByExercise = new Map<number, WorkoutExecution[]>();
			current.executions.forEach((execution) => {
				const executions = executionsByExercise.get(execution.exerciseId) ?? [];
				executions.push(execution);
				executionsByExercise.set(execution.exerciseId, executions);
			});
			const orderedExecutions = exerciseIds.flatMap(
				(exerciseId) => executionsByExercise.get(exerciseId) ?? [],
			);
			// Preserve executions omitted from the reorder dialog (for example,
			// pending removals) so reordering cannot discard local workout state.
			const includedExerciseIds = new Set(exerciseIds);
			orderedExecutions.push(
				...current.executions.filter(
					(execution) => !includedExerciseIds.has(execution.exerciseId),
				),
			);
			return {
				...current,
				executions: orderedExecutions.map((execution, index) => ({
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

	const openRest = (execution: WorkoutExecution) => {
		setRestExecution(execution);
		setRestSeconds(
			execution.performedRestDuration ||
				execution.prescribedRestDuration ||
				DEFAULT_REST_DURATION,
		);
		setApplyRestToExercise(false);
		setApplyRestToWorkout(false);
		setRestOpen(true);
	};

	const saveRest = () => {
		if (!restExecution) return;
		updateWorkout((current) => ({
			...current,
			executions: current.executions.map((item) => {
				const pending = item.status === 'in_progress';
				const sameExercise = item.exerciseId === restExecution.exerciseId;
				const shouldApply =
					item.id === restExecution.id ||
					(pending && (applyRestToWorkout || (applyRestToExercise && sameExercise)));
				return shouldApply ? { ...item, performedRestDuration: restSeconds } : item;
			}),
		}));
		setRestOpen(false);
	};
	const activeRest = useMemo(() => {
		if (restDismissed) return null;
		const completed = (workout?.executions ?? []).filter(
			(item) =>
				!item.pendingRemoval && item.status === 'completed' && item.finishedAt,
		);
		const last = completed.toSorted(
			(a, b) =>
				new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime(),
		)[0];
		if (!last?.finishedAt) return null;
		const duration =
			last.performedRestDuration ||
			last.prescribedRestDuration ||
			DEFAULT_REST_DURATION;
		if (!duration) return null;
		return {
			duration,
			remaining: Math.min(
				duration,
				duration - (now - new Date(last.finishedAt).getTime()) / 1000,
			),
		};
	}, [workout?.executions, now, restDismissed]);
	const formatRest = (seconds: number) => {
		const total = Math.abs(Math.ceil(seconds));
		return `${seconds < 0 ? '-' : ''}${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	};
	const reorderableExercises = Array.from(
		new Map(
			(workout?.executions ?? [])
				.filter((execution) => !execution.pendingRemoval)
				.map((execution) => [
					execution.exerciseId,
					{ id: execution.exerciseId, name: execution.exercise.name },
				]),
		).values(),
	);
	const executionGroups = useMemo(() => {
		const groups = new Map<number, WorkoutExecution[]>();
		(workout?.executions ?? [])
			.filter((execution) => !execution.pendingRemoval)
			.forEach((execution) => {
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
		if (
			!workout ||
			!workoutName.trim() ||
			['completed', 'cancelled'].includes(workout.status)
		)
			return;
		setRenaming(true);
		setError(null);
		const response = await workoutsService.updateName(
			workout.id,
			workoutName.trim(),
		);
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
		setCompletionOpen(false);
		setSaving(true);
		setError(null);
		const userId = getSessionUser()?.sub;
		if (userId === workout.athleteId) {
			try { await waitForPendingWorkoutWrites(userId, workout.id); }
			catch {
				setError('Não foi possível salvar as alterações neste dispositivo.');
				setSaving(false);
				return;
			}
		}
		const result = await workoutsService.complete(workout.id);
		if (!result.success || !result.data)
			setError(result.error || 'Não foi possível finalizar o treino.');
		else {
			const completedWorkout = preloadPrescribedValues(result.data);
			if (userId) setTrainerReview(await readTrainerReview(userId, workout.id));
			dirtyRef.current = true;
			setHasUnsavedChanges(true);
			if (navigator.onLine && userId) void syncPendingWorkouts(userId, { workoutId: workout.id });
			workoutRef.current = completedWorkout;
			setWorkout(completedWorkout);
			setCompletionMessage(
				completionMessages[Math.floor(Math.random() * completionMessages.length)],
			);
			setShowPostCompletion(true);
			window.dispatchEvent(new Event('workout-status-changed'));
		}
		setSaving(false);
	};
	const skipWorkout = async () => {
		if (!workout) return;
		setSaving(true);
		setError(null);
		const result = await workoutsService.skip(workout.id);
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível pular o treino.');
		} else {
			const skippedWorkout = preloadPrescribedValues(result.data);
			const userId = getSessionUser()?.sub;
			if (navigator.onLine && userId) void syncPendingWorkouts(userId, { workoutId: workout.id });
			workoutRef.current = skippedWorkout;
			setWorkout(skippedWorkout);
			dirtyRef.current = true;
			setHasUnsavedChanges(true);
			setSkipOpen(false);
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
	if (showPostCompletion)
		return (
			<WorkoutCompletionScreen
				measurements={preliminaryMeasurements(workout)}
				message={completionMessage}
				onConfirm={() => {
					setShowPostCompletion(false);
					router.replace(`/training/${workout.id}`);
				}}
			/>
		);
	return (
		<section className="mx-auto w-full max-w-5xl space-y-4 pb-10">
			<Modal isOpen={trainerReview.length > 0} title="Alterações do treinador para revisão" onClose={() => undefined}>
				<p className="mb-3 text-sm text-on-surface-variant">As séries realizadas mantiveram seus valores anteriores. As novas prescrições aparecem como séries de contingência e não entram na adesão ou nas métricas.</p>
				<WorkoutComparison executions={trainerReview} />
				<div className="mt-4 flex justify-end"><Button type="button" onClick={() => void (async () => {
					const userId = getSessionUser()?.sub;
					if (userId) await acknowledgeTrainerReview(userId, workout.id);
					setTrainerReview([]);
				})()}>Entendi</Button></div>
			</Modal>
			<Modal isOpen={!!conflict} title={conflict?.status === 'completed' && workout.status !== 'completed' ? 'Este treino já foi finalizado por você. Deseja continuar?' : 'Conflito neste treino'} onClose={() => undefined}>
				<p className="mb-3 text-sm text-on-surface-variant">Compare a versão salva no servidor com as alterações deste dispositivo.</p>
				<div className="grid max-h-[55vh] gap-4 overflow-auto md:grid-cols-2">
					<div><h3 className="mb-2 font-semibold">Versão persistida: {conflict?.templateName}</h3>{conflict && <WorkoutComparison executions={conflict.executions} />}</div>
					<div><h3 className="mb-2 font-semibold">Versão deste dispositivo: {workout.templateName}</h3><WorkoutComparison executions={workout.executions} /></div>
				</div>
				<div className="mt-4 flex flex-wrap justify-end gap-2">
					<Button type="button" variant="outline" onClick={() => void chooseConflict('current')}>{conflict?.status === 'completed' ? 'Abandonar treino' : 'Manter Atual'}</Button>
					<Button type="button" variant="outline" onClick={() => void chooseConflict(conflict?.status === 'completed' ? 'both' : 'saved')}>{conflict?.status === 'completed' ? 'Continuar treinando' : 'Manter Salvo'}</Button>
					{conflict?.status !== 'completed' && <Button type="button" onClick={() => void chooseConflict('both')}>Salvar Ambos</Button>}
				</div>
			</Modal>
			{workout.status === 'in_progress' && activeRest && (
				<>
					<div
						className={`sticky top-2 z-20 rounded-xl border p-3 shadow-lg backdrop-blur ${activeRest.remaining < 0 ? 'border-red-500 bg-red-950/90 text-red-100' : 'border-primary-fixed-dim/50 bg-surface-container/95'}`}
					>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-bold uppercase tracking-wider">
								Descanso
							</span>
							<span className="font-mono text-2xl font-bold">
								{formatRest(activeRest.remaining)}
							</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
							<div
								className={`h-full transition-[width] duration-1000 ${activeRest.remaining < 0 ? 'bg-red-500' : 'bg-primary-fixed-dim'}`}
								style={{
									width: `${Math.max(0, Math.min(100, (activeRest.remaining / activeRest.duration) * 100))}%`,
								}}
							/>
						</div>
					</div>
					{activeRest.remaining < 0 && (
						<div
							className="pointer-events-none fixed inset-0 z-30 border border-red-500/25 shadow-[inset_0_0_28px_4px_rgba(239,68,68,0.1)]"
							aria-hidden="true"
						/>
					)}
				</>
			)}
			<div className="border-b border-outline-variant/60 pb-3">
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={() => router.back()}
						className="inline-flex min-h-8 items-center gap-1 text-sm text-primary-fixed"
					>
						<RiArrowLeftLine /> Voltar
					</button>
					<span className="shrink-0 rounded-full bg-primary-container px-2.5 py-1 text-[11px] font-bold text-on-primary-container">
						{statusLabel(workout.status)}
					</span>
				</div>
				<p className="mt-1 type-label-caps text-primary-fixed">
					Execução do treino
				</p>
				<div className="mt-0.5 flex w-full min-w-0 items-center gap-1">
					<h1 className="line-clamp-2 min-w-0 flex-1 text-base font-bold leading-snug sm:text-lg">
						{workout.templateName}
					</h1>
					{isAthlete && workout.createdBy === getSessionUser()?.sub && !['completed', 'cancelled'].includes(workout.status) && (
						<button
							type="button"
							onClick={() => {
								setWorkoutName(workout.templateName);
								setRenameOpen(true);
							}}
							className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg text-on-surface-variant transition hover:bg-surface-variant hover:text-primary-fixed focus:outline-none focus:ring-2 focus:ring-primary-fixed"
							aria-label="Editar nome do treino"
						>
							<RiEditLine size={16} aria-hidden />
						</button>
					)}
				</div>
				{workout.templateDescription && (
					<p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
						{workout.templateDescription}
					</p>
				)}
			</div>
			{error && <ErrorBox message={error} />}
			{!isAthlete && (
				<div className="rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm text-on-surface-variant">
					Você está visualizando este treino. Apenas o atleta pode editar a execução.
				</div>
			)}
			{workout.status !== 'in_progress' &&
				workout.status !== 'completed' &&
				workout.status !== 'cancelled' &&
				isAthlete && (
					<Button onClick={() => setStartOpen(true)}>
						<RiPlayLine /> Iniciar treino
					</Button>
				)}
			{workout.status === 'completed' ||
			!(isAthlete && workout.status == 'in_progress') ? (
				<>
					<WorkoutMeasurements measurements={preliminaryMeasurements(workout)} />
					<WorkoutComparison
						executions={workout.executions}
						onExerciseClick={openExerciseHistory}
					/>
				</>
			) : (
				<>
					{workout.status === 'in_progress' && <WorkoutMeasurements measurements={preliminaryMeasurements(workout)} />}
					{isAthlete &&
						['pending', 'scheduled', 'in_progress'].includes(workout.status) && (
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									className="border-error/50 text-error hover:border-error hover:text-error"
									disabled={saving}
									onClick={() => setSkipOpen(true)}
								>
									Pular treino
								</Button>
								{structuralEditable && <Button
									variant="outline"
									disabled={saving}
									onClick={() => setReorderOpen(true)}
								>
									Reordenar exercícios
								</Button>}
							</div>
						)}
					{editable && (
						<p
							className="-mt-1 text-right text-xs text-on-surface-variant"
							role="status"
						>
							{saving
								? 'Sincronizando...'
								: hasUnsavedChanges
									? 'Salvo neste dispositivo; aguardando sincronização'
									: '✓ Treino sincronizado'}
						</p>
					)}
					<div className="space-y-4">
						{executionGroups.length === 0 && structuralEditable && (
							<div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-6 text-center">
								<h2 className="text-lg font-bold">Nenhum exercício</h2>
								<p className="mt-1 text-sm text-on-surface-variant">
									Este treino ainda não possui exercícios.
								</p>
								<Button className="mt-5" onClick={openExercisePicker}>
									<RiAddLine /> Adicionar exercício
								</Button>
							</div>
						)}
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
									structuralEditable={!!structuralEditable}
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
									onTitleLongPress={structuralEditable ? () => setReorderOpen(true) : undefined}
									onTitleClick={() => openExerciseHistory(exerciseId, sets[0])}
									onRestClick={openRest}
								/>
							);
						})}
					</div>
				</>
			)}
			{editable && (
				<>
					{executionGroups.length > 0 && structuralEditable && (
						<Button
							variant="outline"
							className="w-full border-primary-container/40 bg-primary-container/5 text-primary-fixed"
							onClick={openExercisePicker}
						>
							<RiAddLine /> Adicionar exercício
						</Button>
					)}
					<div className="flex justify-end border-t border-outline-variant pt-4">
						<Button
							variant="outline"
							disabled={saving || unresolved || executionGroups.length === 0}
							onClick={() => setCompletionOpen(true)}
						>
							Finalizar treino
						</Button>
					</div>
				</>
			)}
			<Modal
				isOpen={completionOpen}
				title="Finalizar treino?"
				description="Confira as séries concluídas antes de encerrar. Esta ação finalizará a sessão atual."
				onClose={() => !saving && setCompletionOpen(false)}
			>
				<div className="flex justify-end gap-3">
					<Button
						variant="ghost"
						disabled={saving}
						onClick={() => setCompletionOpen(false)}
					>
						Cancelar
					</Button>
					<Button disabled={saving} onClick={() => void complete()}>
						<RiCheckLine /> {saving ? 'Finalizando...' : 'Confirmar finalização'}
					</Button>
				</div>
			</Modal>
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
						<Button
							variant="ghost"
							disabled={renaming}
							onClick={() => setRenameOpen(false)}
						>
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
			<Modal
				isOpen={restOpen}
				title="Configurar descanso"
				description="Defina o descanso após esta série. Ele inicia automaticamente quando a série for concluída."
				onClose={() => setRestOpen(false)}
			>
				<div className="space-y-5">
					<Input
						label="Tempo de descanso"
						type="time"
						value={restSeconds}
						onTimeChange={setRestSeconds}
					/>
					<Checkbox
						label="Aplicar às séries faltantes deste exercício"
						checked={applyRestToExercise}
						onChange={(event) => {
							setApplyRestToExercise(event.target.checked);
							if (event.target.checked) setApplyRestToWorkout(false);
						}}
					/>
					<Checkbox
						label="Aplicar a todas as séries faltantes do treino"
						checked={applyRestToWorkout}
						onChange={(event) => {
							setApplyRestToWorkout(event.target.checked);
							if (event.target.checked) setApplyRestToExercise(false);
						}}
					/>
					<div className="flex justify-end gap-3">
						<Button variant="ghost" onClick={() => setRestOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={saveRest}>Salvar descanso</Button>
					</div>
				</div>
			</Modal>
			<Modal
				isOpen={skipOpen}
				title="Pular treino?"
				description="Todos os exercícios serão marcados como pulados e o treino será cancelado. Esta ação não pode ser desfeita."
				onClose={() => !saving && setSkipOpen(false)}
			>
				<div className="flex justify-end gap-3">
					<Button
						variant="ghost"
						disabled={saving}
						onClick={() => setSkipOpen(false)}
					>
						Voltar
					</Button>
					<Button
						variant="outline"
						className="border-error/50 text-error hover:border-error hover:text-error"
						disabled={saving}
						onClick={() => void skipWorkout()}
					>
						{saving ? 'Pulando...' : 'Confirmar pulo'}
					</Button>
				</div>
			</Modal>
			<Modal
				isOpen={historyOpen}
				title={
					exerciseHistory ? (
						<button
							type="button"
							onClick={() =>
								router.push(
									`/athlete/${workout.athleteId}/exercises/${exerciseHistory.id}?returnTo=${encodeURIComponent(`/training/${id}`)}`,
								)
							}
							className="inline-flex items-center gap-2 text-left hover:underline"
						>
							{exerciseHistory.name}
							<RiExternalLinkLine aria-label="Abrir detalhes do exercício" />
						</button>
					) : (
						'Histórico'
					)
				}
				onClose={() => setHistoryOpen(false)}
			>
				{exerciseHistory?.rows?.length ? (
					<p className="-mt-3 mb-4 text-sm text-on-surface-variant">
						{exerciseHistory.rows[0].workoutName} ·{' '}
						{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
							new Date(exerciseHistory.rows[0].performedAt),
						)}
					</p>
				) : null}

				{exerciseHistory?.rows === null ? (
					<p>Carregando histórico…</p>
				) : !exerciseHistory?.rows?.length ? (
					<p className="text-on-surface-variant">
						Não há execução anterior disponível.
					</p>
				) : (
					<ExerciseHistorySeriesList
						series={exerciseHistory.rows}
						metric1Label={exerciseHistory.metric1Label}
						metric2Label={exerciseHistory.metric2Label}
					/>
				)}
			</Modal>
			{pickerOpen && (
				<ExercisePicker
					selected={pickerSelection}
					onChange={setPickerSelection}
					onClose={() => void addExercises(pickerSelection)}
					filterExercise={(exercise) =>
						pickerSelection.some((selected) => selected.id === exercise.id) ||
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
