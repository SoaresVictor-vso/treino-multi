import { enums, types } from '@treino-multi/shared';
const { ExecutionStatus: SharedExecutionStatus, WorkoutStatus: SharedWorkoutStatus, ExecutionSetType: SharedExecutionSetType } = enums;
type SharedExecutionStatus = enums.ExecutionStatus;
type SharedWorkoutStatus = enums.WorkoutStatus;
type SharedExecutionSetType = enums.ExecutionSetType;
type MeasurementPresentation = types.MeasurementPresentation;
import { authenticatedRequest } from '@/gateway/client';
import { getSessionUser } from '@/lib/auth';
import { createLocalWorkout, editLocalWorkout, readAthleteSourceName, readCurrentWorkout, readTrainerWorkoutList, readVisibleWorkouts, syncPendingWorkouts, updateLocalDraft, withTrainerContingencies } from '@/lib/offline-contingency';
import type { Exercise, Metric } from '@/gateway/services/parametro';
import type { Activity } from '@/gateway/services/workout-templates';



export type ExecutionStatus = `${SharedExecutionStatus}`;
export type WorkoutStatus = `${SharedWorkoutStatus}`;
export type ExecutionSetType = `${SharedExecutionSetType}`;
export type TrainingActivity = Activity & { setType: ExecutionSetType };

export type WorkoutExecution = {
	id: number;
	exerciseId: number;
	position: number;
	prescribedMetric1: number | null;
	prescribedMetric2: number | null;
	metric1Type: 'v';
	metric2Type: 'v' | 'p' | null;
	prescribedPse: number | null;
	prescribedRestDuration: number | null;
	performedMetric1: number | null;
	performedMetric2: number | null;
	predictedRm?: number | null;
	performedPse: number | null;
	performedRestDuration: number | null;
	performedNote: string | null;
	setType: ExecutionSetType;
	adherenceSnapshot?: { prescribedMetric1: number | null; prescribedMetric2: number | null; prescribedPse: number | null; prescribedRestDuration: number | null } | null;
	finishedAt: string | null;
	startedAt?: string | null;
	status: ExecutionStatus;
	exercise: Exercise & { metric_1: Metric; metric_2?: Metric | null };
	referenceGroup: { id: number; name: string } | null;
	referencePersonalRecord: {
		id: string;
		value: number;
		measuredAt: string;
	} | null;
	pendingRemoval?: boolean;
};

export type WorkoutExerciseNote = {
	exerciseId: number;
	note: string | null;
	athleteNote: string | null;
};

export type WorkoutDetail = {
	id: string;
	athleteId: string;
	createdBy: string;
	updatedBy?: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	finishedAt: string | null;
	syncRevision?: number;
	status: WorkoutStatus;
	executions: WorkoutExecution[];
	exerciseNotes: WorkoutExerciseNote[];
	measurements: WorkoutMeasurement[];
};

export type WorkoutMeasurement = {
	id: string;
	measurementId: string;
	value: number;
	/** Internal ranking value; intentionally never rendered. */
	score: number;
	key: string;
	name: string;
	icon: string;
	presentation: MeasurementPresentation;
};

export type MyWorkout = {
	id: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	status: 'pending' | 'scheduled' | 'in_progress';
};

export type CalendarWorkout = {
	id: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	status: WorkoutStatus;
};

export type WorkoutsCalendar = {
	referenceDate: string;
	workouts: CalendarWorkout[];
};

export type TrainerWorkout = {
	id: string;
	athleteId: string;
	athleteName: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
};

export type GenerateWorkoutsFromTemplateResponse = { count: number };

export type CreateMyWorkoutDto = {
	name?: string;
	description?: string;
	activities?: TrainingActivity[];
	scheduledDate?: string | null;
	startImmediately?: boolean;
	/** Registra um treino já realizado em uma data anterior. */
	recordAsCompleted?: boolean;
	performedAt?: string;
	durationSeconds?: number;
	clientTimeZone?: string;
};

export type AthleteWorkout = {
	id: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	status: WorkoutStatus;
};

export type AthleteWorkoutsResponse = {
	athlete: { id: string; name: string };
	workouts: AthleteWorkout[];
};

export type UpdateWorkoutExecution = Omit<
	WorkoutExecution,
	| 'id'
	| 'exercise'
	| 'referenceGroup'
	| 'referencePersonalRecord'
	| 'metric1Type'
	| 'metric2Type'
	| 'predictedRm'
	| 'finishedAt'
	| 'pendingRemoval'
	| 'prescribedMetric1'
	| 'prescribedMetric2'
	| 'prescribedPse'
	| 'prescribedRestDuration'
	| 'setType'
> & Partial<Pick<WorkoutExecution, 'prescribedMetric1' | 'prescribedMetric2' | 'prescribedPse' | 'prescribedRestDuration' | 'setType'>> & { id?: number };

export const workoutsService = {
	findMine: async () => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		const workouts = await readVisibleWorkouts(user.sub);
		return { success: true, status: 200, data: workouts
			.filter((workout): workout is WorkoutDetail & { status: MyWorkout['status'] } =>
				['pending', 'scheduled', 'in_progress'].includes(workout.status))
			.map(({ id, templateName, templateDescription, scheduledDate, status }) =>
				({ id, templateName, templateDescription, scheduledDate, status })) };
	},
	findMyCalendar: (date: string, timeZone: string) => {
		void timeZone;
		return (async () => {
			const user = getSessionUser();
			if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
			const workouts = await readVisibleWorkouts(user.sub);
			return { success: true, status: 200, data: { referenceDate: date,
				workouts: workouts.map(({ id, templateName, templateDescription, scheduledDate, performedAt, status }) =>
					({ id, templateName, templateDescription, scheduledDate, performedAt, status })) } };
		})();
	},
	findTrainerWorkouts: async () => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		if (!navigator.onLine) return { success: false, status: 0, error: 'É necessária conexão para visualizar treinos.' };
		return { success: true, status: 200, data: await readTrainerWorkoutList(user.sub) };
	},
	findByAthlete: async (athleteId: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		if (user.sub !== athleteId && !navigator.onLine) return { success: false, status: 0, error: 'É necessária conexão para visualizar treinos.' };
		const [all, name] = await Promise.all([readVisibleWorkouts(user.sub), readAthleteSourceName(user.sub, athleteId)]);
		const workouts = all.filter((workout) => workout.athleteId === athleteId).map(({ id, templateName, templateDescription, scheduledDate, performedAt, status }) =>
			({ id, templateName, templateDescription, scheduledDate, performedAt, status }));
		return { success: true, status: 200, data: { athlete: { id: athleteId, name: name || user.name || '' }, workouts } };
	},
	findOne: async (id: string) => {
		const user = getSessionUser();
		if (user?.roles.includes(enums.Role.TENANT_CLIENT)) {
			const local = await readCurrentWorkout(user.sub, id);
			return local ? { success: true, status: 200, data: local.workout } :
				{ success: false, status: 404, error: 'Treino não disponível neste dispositivo.' };
		}
		if (typeof navigator !== 'undefined' && !navigator.onLine)
			return { success: false, status: 0, error: 'É necessária conexão para visualizar este treino.' };
		if (user) {
			const cached = await readCurrentWorkout(user.sub, id);
			if (cached) return { success: true, status: 200, data: cached.workout };
		}
		return { success: false, status: 404, error: 'Sincronize os treinos do atleta antes de abrir este treino.' };
	},
	start: async (id: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			const workout = await editLocalWorkout(user.sub, id, (current) => {
				if (!['pending', 'scheduled'].includes(current.status)) throw new Error('Este treino não pode ser iniciado.');
				const now = new Date().toISOString();
				return { ...current, status: 'in_progress', performedAt: now, finishedAt: null,
					executions: current.executions.map((execution) => ({ ...execution,
						status: execution.status === 'pending' ? 'in_progress' as const : execution.status,
					})) };
			});
			return { success: true, status: 200, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível iniciar.' }; }
	},
	updateExecutions: (
		id: string,
		executions: UpdateWorkoutExecution[],
		exerciseNotes: Pick<WorkoutExerciseNote, 'exerciseId' | 'athleteNote'>[],
		deletedExecutionIds: number[] = [],
	) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/executions`, {
			method: 'PATCH',
			body: JSON.stringify({ executions, exerciseNotes, deletedExecutionIds }),
		}),
	complete: async (id: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			let workout = await editLocalWorkout(user.sub, id, (current) => {
				if (current.status !== 'in_progress') throw new Error('Este treino não está em andamento.');
				if (current.executions.some((item) => !item.pendingRemoval && !['completed', 'skipped'].includes(item.status)))
					throw new Error('Conclua ou pule todas as séries.');
				return { ...current, status: 'completed', finishedAt: new Date().toISOString() };
			});
			const reviewed = await withTrainerContingencies(user.sub, workout);
			if (reviewed !== workout) workout = await editLocalWorkout(user.sub, id, () => reviewed);
			return { success: true, status: 200, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível finalizar.' }; }
	},
	skip: async (id: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			const workout = await editLocalWorkout(user.sub, id, (current) => ({
				...current, status: 'cancelled', finishedAt: new Date().toISOString(),
				executions: current.executions.map((item) => ({ ...item, status: item.status === 'completed' ? item.status : 'skipped' })),
			}));
			return { success: true, status: 200, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível cancelar.' }; }
	},
	generateFromTemplate: (
		athleteIds: string[],
		templateId: string,
		scheduledDate?: string,
	) =>
		authenticatedRequest<GenerateWorkoutsFromTemplateResponse>(
			'workouts/from-template',
			{
			method: 'POST',
			body: JSON.stringify({ athleteIds, templateId, scheduledDate }),
		},
	),
	createMine: async (input: CreateMyWorkoutDto) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			const workout = await createLocalWorkout(user.sub, user.name, input);
			if (navigator.onLine) void syncPendingWorkouts(user.sub);
			return { success: true, status: 201, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível criar.' }; }
	},
	updateName: async (id: string, name: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			const workout = await editLocalWorkout(user.sub, id, (current) => {
				if (current.createdBy !== user.sub) throw new Error('Somente o autor pode renomear o treino.');
				return { ...current, templateName: name.trim() };
			});
			return { success: true, status: 200, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível renomear.' }; }
	},
	createForAthlete: (athleteId: string, workout: CreateMyWorkoutDto) =>
		authenticatedRequest<WorkoutDetail>(`workouts/athletes/${athleteId}`, {
			method: 'POST',
			body: JSON.stringify(workout),
		}),
	updateDraft: async (id: string, workout: CreateMyWorkoutDto) => {
		const user = getSessionUser();
		if (user?.roles.includes(enums.Role.TENANT_CLIENT)) {
			try { return { success: true, status: 200, data: await updateLocalDraft(user.sub, id, workout) }; }
			catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Falha ao editar treino.' }; }
		}
		return authenticatedRequest<WorkoutDetail>(`workouts/${id}/draft`, { method: 'PATCH', body: JSON.stringify(workout) });
	},
	cancel: (id: string) => workoutsService.skip(id),
	reschedule: async (id: string, scheduledDate: string) => {
		const user = getSessionUser();
		if (!user) return { success: false, status: 401, error: 'Sessão expirada.' };
		try {
			const workout = await editLocalWorkout(user.sub, id, (current) => {
				if (current.createdBy !== user.sub) throw new Error('Somente o autor pode reagendar o treino.');
				return { ...current, scheduledDate, status: 'scheduled' };
			});
			return { success: true, status: 200, data: workout };
		} catch (cause) { return { success: false, status: 400, error: cause instanceof Error ? cause.message : 'Não foi possível reagendar.' }; }
	},
};
