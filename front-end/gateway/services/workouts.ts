import { authenticatedRequest } from '@/gateway/client';
import type { Exercise, Metric } from '@/gateway/services/parametro';
import type { Activity } from '@/gateway/services/workout-templates';

export type ExecutionStatus =
	| 'pending'
	| 'in_progress'
	| 'completed'
	| 'skipped';
export type WorkoutStatus = ExecutionStatus | 'scheduled' | 'cancelled';
export type ExecutionSetType = 'padrao' | 'aquecimento' | 'dropset' | 'falha';
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
	finishedAt: string | null;
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
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	finishedAt: string | null;
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
	presentation: {
		containerClass: string;
		iconClass: string;
		valueClass: string;
		labelClass: string;
	};
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
> & { id?: number };

export const workoutsService = {
	findMine: () => authenticatedRequest<MyWorkout[]>('workouts/me'),
	findMyCalendar: (date: string, timeZone: string) => {
		const params = new URLSearchParams({ date, timeZone });
		return authenticatedRequest<WorkoutsCalendar>(
			`workouts/me/calendar?${params.toString()}`,
		);
	},
	findTrainerWorkouts: () =>
		authenticatedRequest<TrainerWorkout[]>('workouts/trainer'),
	findByAthlete: (athleteId: string) =>
		authenticatedRequest<AthleteWorkoutsResponse>(`workouts/athletes/${athleteId}`),
	findOne: (id: string) => authenticatedRequest<WorkoutDetail>(`workouts/${id}`),
	start: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/start`, {
			method: 'PATCH',
		}),
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
	complete: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/complete`, {
			method: 'PATCH',
		}),
	skip: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/skip`, {
			method: 'PATCH',
		}),
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
	createMine: (workout: CreateMyWorkoutDto) =>
		authenticatedRequest<WorkoutDetail>('workouts/me', {
			method: 'POST',
			body: JSON.stringify(workout),
		}),
	updateName: (id: string, name: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/name`, {
			method: 'PATCH',
			body: JSON.stringify({ name }),
		}),
	createForAthlete: (athleteId: string, workout: CreateMyWorkoutDto) =>
		authenticatedRequest<WorkoutDetail>(`workouts/athletes/${athleteId}`, {
			method: 'POST',
			body: JSON.stringify(workout),
		}),
	updateDraft: (id: string, workout: CreateMyWorkoutDto) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/draft`, {
			method: 'PATCH',
			body: JSON.stringify(workout),
		}),
	cancel: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/cancel`, {
			method: 'PATCH',
		}),
	reschedule: (id: string, scheduledDate: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/schedule`, {
			method: 'PATCH',
			body: JSON.stringify({ scheduledDate }),
		}),
};
