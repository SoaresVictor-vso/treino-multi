import type {
	Activity,
	Exercise,
} from '@/app/(authenticated)/workout-template/types';

export type RegisterType = 'p' | 'v';

export type ExerciseConfig = {
	metric_1: string;
	metric_2: string;
	pse: string;
	metric_2_type: RegisterType;
	rest_duration: number;
};

export const DEFAULT_REST_DURATION = 90;

export function secondsToTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function timeToSeconds(time: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
	return hours * 3600 + minutes * 60 + seconds;
}

export function getConfigsFromActivities(activities: Activity[]) {
	return activities.reduce<Record<number, ExerciseConfig[]>>(
		(configs, activity) => {
			const config: ExerciseConfig = {
				metric_1: activity.metric_1?.toString() ?? '',
				metric_2: activity.metric_2?.toString() ?? '',
				pse: activity.pse?.toString() ?? '',
				metric_2_type: activity.type_2 ?? 'p',
				rest_duration: activity.rest_duration ?? DEFAULT_REST_DURATION,
			};
			return {
				...configs,
				[activity.exercise]: [...(configs[activity.exercise] ?? []), config],
			};
		},
		{},
	);
}

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
