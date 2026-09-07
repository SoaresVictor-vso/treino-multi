import { authenticatedRequest } from '@/gateway/client';
import type { Exercise, Metric } from '@/gateway/services/parametro';
import type { Activity } from '@/gateway/services/workout-templates';

export type ExecutionStatus =
	| 'pending'
	| 'in_progress'
	| 'completed'
	| 'skipped';
export type WorkoutStatus = ExecutionStatus | 'scheduled' | 'cancelled';

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
	performedPse: number | null;
	performedRestDuration: number | null;
	performedNote: string | null;
	status: ExecutionStatus;
	exercise: Exercise & { metric_1: Metric; metric_2?: Metric | null };
	referenceGroup: { id: number; name: string } | null;
	referencePersonalRecord: {
		id: string;
		value: number;
		measuredAt: string;
	} | null;
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
	status: WorkoutStatus;
	executions: WorkoutExecution[];
	exerciseNotes: WorkoutExerciseNote[];
};

export type MyWorkout = {
	id: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	status: 'pending' | 'scheduled' | 'in_progress';
};

export type CompletedWorkout = Omit<MyWorkout, 'status'> & {
	status: 'completed';
	performedAt: string | null;
};

export type CompletedWorkoutsPage = {
	workouts: CompletedWorkout[];
	total: number;
	nextCursor: string | null;
};

export type AgendaWorkoutsPage = {
	workouts: MyWorkout[];
	total: number;
	inProgress: MyWorkout | null;
	nextCursor: string | null;
};

export type CompletedWorkoutsCalendar = {
	period: 'week' | 'month';
	referenceDate: string;
	workouts: CompletedWorkout[];
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
	activities?: Activity[];
	scheduledDate?: string;
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
> & { id?: number };

export const workoutsService = {
	findMine: () => authenticatedRequest<MyWorkout[]>('workouts/me'),
	findMyAgenda: (cursor?: string) =>
		authenticatedRequest<AgendaWorkoutsPage>(
			`workouts/me/agenda${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
		),
	findMyCompleted: (cursor?: string) =>
		authenticatedRequest<CompletedWorkoutsPage>(
			`workouts/me/completed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
		),
	findMyCompletedForCalendar: (
		period: 'week' | 'month',
		date?: string,
	) => {
		const params = new URLSearchParams({ period });
		if (date) params.set('date', date);
		return authenticatedRequest<CompletedWorkoutsCalendar>(
			`workouts/me/completed/calendar?${params.toString()}`,
		);
	},
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
	) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/executions`, {
			method: 'PATCH',
			body: JSON.stringify({ executions, exerciseNotes }),
		}),
	complete: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/complete`, {
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
};
