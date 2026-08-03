import { authenticatedRequest } from '../client';
import { type Exercise, type Metric } from './parametro';

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

type WorkoutTemplateExercise = Omit<
	Exercise,
	'metric_1' | 'metric_2' | 'visual_url'
> & {
	metric1: Metric;
	metric2?: Metric | null;
	visualUrl?: string | null;
};

export interface WorkoutActivityResponse extends WorkoutActivity {
	id: number;
	workoutTemplateId: string;
	exercise?: WorkoutTemplateExercise;
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
	id?: number;
	exerciseId: number;
	metric1?: number;
	metric2?: number;
	type1: 'v';
	type2?: RegisterType;
	pse: number;
	restDuration?: number;
	note?: string;
};

export type ActivityInput = Omit<Activity, 'id'>;

export type WorkoutTemplate = {
	tenantId: string;
	created_by: string;
	updated_by: string;
	created_at: string;
	updated_at: string;
	name: string;
	description: string;
	activities: ActivityInput[];
};

export type CreateWorkoutTemplateDto = Pick<
	WorkoutTemplate,
	'tenantId' | 'name' | 'description' | 'activities'
>;

export type UpdateWorkoutTemplateDto = Partial<
	Omit<CreateWorkoutTemplateDto, 'activities'>
> & {
	activities?: Activity[];
};

export type WorkoutTemplateFormDto = Omit<
	CreateWorkoutTemplateDto,
	'activities'
> & {
	activities: Activity[];
};

export type Template = {
	id: string;
	tenantId: string;
	name: string;
	description: string;
	exercises: Exercise[];
	activities: Activity[];
};

export type TemplateModalState = {
	mode: 'create' | 'view' | 'edit' | 'remove';
	template?: Template;
	templateId?: string;
	name?: string;
};

export function secondsToTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function timeToSeconds(value: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number);
	return hours * 3600 + minutes * 60 + seconds;
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
