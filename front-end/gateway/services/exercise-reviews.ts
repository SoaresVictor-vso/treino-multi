import { authenticatedRequest } from '../client';

export type ExerciseReviewPoint = {
	date: string; workoutId: string; predictedRm: number | null; repetitions: number | null;
	weight: number | null; distance: number | null; duration: number | null; tonnage: number | null; pace: number | null;
};
export type ExerciseReviewSummary = {
	exercise: { id: number; name: string; metrics: { name: string; symbol: string }[] };
	period: { from: string; to: string };
	currentRp: { value: number; measuredAt: string } | null;
	bestSet: ExerciseReviewPoint | null;
	estimatedRm: number | null;
	charts: ExerciseReviewPoint[];
};
export type ExerciseReviewSet = { position: number; setType: string; metric1: number | null; metric2: number | null; predictedRm: number | null; note: string | null };
export type ExerciseReviewWorkout = { id: string; workoutName: string; performedAt: string; sets: number; bestPredictedRm: number | null; tonnage: number | null; series: ExerciseReviewSet[] };

function query(from?: string, to?: string, page?: number) {
	const params = new URLSearchParams(); if (from) params.set('from', from); if (to) params.set('to', to); if (page) params.set('page', String(page));
	return params.toString() ? `?${params}` : '';
}
export const exerciseReviewsService = {
	summary: (athleteId: string, exerciseId: number) => authenticatedRequest<ExerciseReviewSummary>(`exercise-reviews/athletes/${athleteId}/exercises/${exerciseId}/summary`),
	workouts: (athleteId: string, exerciseId: number, page?: number) => authenticatedRequest<{ items: ExerciseReviewWorkout[]; page: number; limit: number }>(`exercise-reviews/athletes/${athleteId}/exercises/${exerciseId}/workouts${query(undefined, undefined, page)}`),
	latest: (athleteId: string, exerciseId: number) => authenticatedRequest<{ item: Array<{ workoutId: string; workoutName: string; performedAt: string; metric1: number | null; metric2: number | null; predictedRm: number | null; setType: string; note: string | null }> | null }>(`exercise-reviews/athletes/${athleteId}/exercises/${exerciseId}/latest`),
};
