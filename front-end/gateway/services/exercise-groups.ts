import { authenticatedRequest } from '@/gateway/client';

export type ExerciseGroup = {
	id: number;
	name: string;
	tenantId: string;
	metric1Id: number;
	metric2Id: number | null;
	metric1: { id: number; name: string; symbol: string };
	metric2: { id: number; name: string; symbol: string } | null;
};

export type ExerciseGroupExercise = {
	exerciseId: number;
	exercise: {
		id: number;
		name: string;
		description: string;
		metric1Id: number;
		metric2Id: number | null;
	};
};

export type SaveExerciseGroupDto = {
	name: string;
	tenantId?: string;
	metric1Id: number;
	metric2Id?: number | null;
	exerciseIds: number[];
};

export type UpdateExerciseGroupDto = {
	name?: string;
	exerciseIdsToAdd: number[];
	exerciseIdsToRemove: number[];
};

export const exerciseGroupsService = {
	findAll: () => authenticatedRequest<ExerciseGroup[]>('exercise-groups'),
	findExercises: (id: number) =>
		authenticatedRequest<ExerciseGroupExercise[]>(
			`exercise-groups/${id}/exercises`,
		),
	create: (dto: SaveExerciseGroupDto) =>
		authenticatedRequest<ExerciseGroup>('exercise-groups', {
			method: 'POST',
			body: JSON.stringify(dto),
		}),
	update: (id: number, dto: UpdateExerciseGroupDto) =>
		authenticatedRequest<ExerciseGroup>(`exercise-groups/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(dto),
		}),
	remove: (id: number) =>
		authenticatedRequest<void>(`exercise-groups/${id}`, { method: 'DELETE' }),
};
