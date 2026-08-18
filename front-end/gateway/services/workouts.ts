import { authenticatedRequest } from '@/gateway/client';
import type { Exercise, Metric } from '@/gateway/services/parametro';

export type ExecutionStatus =
	| 'pending'
	| 'in_progress'
	| 'completed'
	| 'skipped';
export type WorkoutStatus = ExecutionStatus;

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

export type WorkoutDetail = {
	id: string;
	athleteId: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	status: WorkoutStatus;
	executions: WorkoutExecution[];
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
	findMyCompleted: () =>
		authenticatedRequest<CompletedWorkout[]>('workouts/me/completed'),
	findTrainerWorkouts: () =>
		authenticatedRequest<TrainerWorkout[]>('workouts/trainer'),
	findOne: (id: string) => authenticatedRequest<WorkoutDetail>(`workouts/${id}`),
	start: (id: string) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/start`, {
			method: 'PATCH',
		}),
	updateExecutions: (id: string, executions: UpdateWorkoutExecution[]) =>
		authenticatedRequest<WorkoutDetail>(`workouts/${id}/executions`, {
			method: 'PATCH',
			body: JSON.stringify({ executions }),
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
};
