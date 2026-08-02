import { authenticatedRequest } from '../client';
import { Exercise } from './parametro';

export type RegisterType = 'p' | 'v';

export interface WorkoutActivity {
	exerciseId: number;
	metric1?: number | null;
	metric2?: number | null;
	type1: RegisterType;
	type2: RegisterType;
	pse: number;
	restDuration: number | null;
	note: string | null;
}

export interface WorkoutActivityResponse extends WorkoutActivity {
	id: number;
	workoutTemplateId: string;
	exercise?: {
		id: number;
		name: string;
	};
}

export interface WorkoutTemplateSummary {
	id: string;
	name: string;
	description: string;
	exercises: string[];
}

export interface WorkoutTemplateResponse {
	id: string;
	tenantId: string;
	createdBy: string;
	updatedBy: string;
	name: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	activities: WorkoutActivityResponse[];
}

export type Activity = {
	exercise: number;
	metric_1?: number;
	metric_2?: number;
	type_1: 'v';
	type_2?: RegisterType;
	pse: number;
	rest_duration?: number;
	note?: string;
};

export type WorkoutTemplate = {
	tenant_id: string;
	created_by: string;
	updated_by: string;
	created_at: string;
	updated_at: string;
	name: string;
	description: string;
	activities: Activity[];
};

export type CreateWorkoutTemplateDto = Pick<
	WorkoutTemplate,
	'name' | 'description' | 'activities'
>;

export type UpdateWorkoutTemplateDto = Partial<CreateWorkoutTemplateDto>;

export type Template = {
	id: number;
	title: string;
	description: string;
	exercises: Exercise[];
	activities: Activity[];
};

export type TemplateModalState = {
	mode: 'view' | 'edit';
	template: Template;
};

export function secondsToTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function timeToSeconds(value: string): number {
	const [minutes, seconds] = value.split(':').map(Number);
	return minutes * 60 + seconds;
}

const API_ENDPOINT = 'workout-templates';

export async function findAll() {
	return authenticatedRequest<WorkoutTemplateSummary[]>(API_ENDPOINT, {
		method: 'GET',
	});
}

export async function findOne(id: string) {
	return authenticatedRequest<WorkoutTemplateResponse>(`${API_ENDPOINT}/${id}`, {
		method: 'GET',
	});
}

export async function create(input: CreateWorkoutTemplateDto) {
	return authenticatedRequest<WorkoutTemplateResponse>(API_ENDPOINT, {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export async function update(id: string, input: UpdateWorkoutTemplateDto) {
	return authenticatedRequest<WorkoutTemplateResponse>(`${API_ENDPOINT}/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(input),
	});
}

export async function remove(id: string) {
	return authenticatedRequest<void>(`${API_ENDPOINT}/${id}`, {
		method: 'DELETE',
	});
}
