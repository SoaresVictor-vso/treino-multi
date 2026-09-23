import { authenticatedRequest } from '../client';

export type PeriodValue = { current: number | null; previous: number | null };
export type AnalysisIndicators = {
  averageRpe: PeriodValue;
  adherence: PeriodValue;
  rpeAdherence: PeriodValue;
};
export type MeasurementChartData = {
  measurementId: string;
  key: string;
  name: string;
  icon: string | null;
  presentation: { containerClass: string; iconClass: string; valueClass: string; labelClass: string } | null;
  unit: string | null;
  aggregation: 'sum' | 'average';
  currentPeriod: { day: string; value: number; consideredSets: number }[];
  previousPeriod: { day: string; value: number; consideredSets: number }[];
  currentTotal: number | null;
  previousTotal: number | null;
};
export type LifetimeStats = {
  totalTonnage: number | null;
  totalWorkouts: number;
  totalRepetitions: number;
  totalSets: number;
};
export type AthleteAnalysis = {
  athleteName: string;
  days: number;
  period: { currentStartDay: string; previousStartDay: string; endDay: string };
  measurements: MeasurementChartData[];
  lifetime: LifetimeStats;
  exercises: { exerciseId: number; name: string; totalWorkouts: number }[];
};
export type ExerciseAnalysis = {
  period: '7' | '15' | '30' | '3m';
  indicators: AnalysisIndicators;
  lifetime: Omit<LifetimeStats, 'totalRepetitions'> & { totalRepetitions: number | null };
};
export const analysisService = {
  athlete: (athleteId: string, days: 7 | 15 | 30) =>
    authenticatedRequest<AthleteAnalysis>(`athlete/${athleteId}/analysis?days=${days}`),
  exercise: (athleteId: string, exerciseId: number, period: 7 | 15 | 30 | '3m') =>
    authenticatedRequest<ExerciseAnalysis>(`exercise-reviews/athletes/${athleteId}/exercises/${exerciseId}/analysis?period=${period}`),
};
