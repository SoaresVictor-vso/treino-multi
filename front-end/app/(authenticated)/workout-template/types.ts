export enum MetricFieldType {
	INT = 'int',
	DECIMAL = 'decimal',
	TIME = 'time',
}

export type Metric = {
	id: number;
	name: string;
	symbol: string;
	fieldType: MetricFieldType;
};

// export type MetricLabel = {
// 	[key in Metric]: string;
// };

// export type MetricUnit = {
// 	[key in Metric]: string;
// };
/** p - percentual, v - value */
export type RegisterType = 'p' | 'v';

export type Exercise = {
	id: number;
	name: string;
	metric_1: Metric;
	metric_2?: Metric;
	visual_url?: string;
};
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

export type ExerciseConfig = {
	metric_1: string;
	metric_2: string;
	pse: string;
	metric_2_type: RegisterType;
	rest_duration: number;
};

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
