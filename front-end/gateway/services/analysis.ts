import { constants } from '@treino-multi/shared';
import { getSessionUser } from '@/lib/auth';
import { readAthleteSourceName, readVisibleWorkouts } from '@/lib/offline-contingency';
import { preliminaryMeasurements } from '@/components/training/preliminaryMeasurements';
import type { WorkoutDetail } from './workouts';

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
  athlete: async (athleteId: string, days: 7 | 15 | 30) => {
    try { return { success: true, status: 200, data: await calculateAthleteAnalysis(athleteId, days) }; }
    catch (cause) { return { success: false, status: 0, error: cause instanceof Error ? cause.message : 'Falha na análise local.' }; }
  },
  exercise: async (athleteId: string, exerciseId: number, period: 7 | 15 | 30 | '3m') => {
    try { return { success: true, status: 200, data: await calculateExerciseAnalysis(athleteId, exerciseId, period) }; }
    catch (cause) { return { success: false, status: 0, error: cause instanceof Error ? cause.message : 'Falha na análise local.' }; }
  },
};

async function completedWorkouts(athleteId: string): Promise<WorkoutDetail[]> {
  const user = getSessionUser();
  if (!user) throw new Error('Sessão indisponível.');
  if (user.sub !== athleteId && !navigator.onLine) throw new Error('É necessária conexão para visualizar análises de atletas.');
  return (await readVisibleWorkouts(user.sub)).filter((workout) =>
    workout.athleteId === athleteId && workout.status === 'completed');
}

function localDay(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dayOffset(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function lifetime(workouts: WorkoutDetail[], exerciseId?: number): LifetimeStats {
  const relevant = workouts.filter((workout) => exerciseId === undefined || workout.executions.some((row) => row.exerciseId === exerciseId && row.status === 'completed'));
  const sets = relevant.flatMap((workout) => workout.executions.filter((row) => row.status === 'completed' && row.setType !== 'contingencia_offline' && (exerciseId === undefined || row.exerciseId === exerciseId)));
  const repetitions = sets.reduce((sum, row) => sum + (row.exercise.metric_1.name === 'repeticoes' ? Number(row.performedMetric1 || 0) : row.exercise.metric_2?.name === 'repeticoes' ? Number(row.performedMetric2 || 0) : 0), 0);
  const tonnage = sets.reduce((sum, row) => {
    const weight = row.exercise.metric_1.name === 'peso' ? Number(row.performedMetric1 || 0) : row.exercise.metric_2?.name === 'peso' ? Number(row.performedMetric2 || 0) : 0;
    const reps = row.exercise.metric_1.name === 'repeticoes' ? Number(row.performedMetric1 || 0) : row.exercise.metric_2?.name === 'repeticoes' ? Number(row.performedMetric2 || 0) : 0;
    return sum + weight * reps;
  }, 0);
  return { totalTonnage: tonnage || null, totalWorkouts: relevant.length, totalRepetitions: repetitions, totalSets: sets.length };
}

function periodValue(workouts: WorkoutDetail[], key: string, start: string, end: string, exerciseId?: number): number | null {
  const values = workouts.filter((workout) => {
    const day = workout.performedAt ? localDay(workout.performedAt) : '';
    return day >= start && day < end;
  }).flatMap((workout) => preliminaryMeasurements(exerciseId === undefined ? workout : {
    ...workout, executions: workout.executions.filter((row) => row.exerciseId === exerciseId),
  }).filter((row) => row.key === key).map((row) => row.value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function calculateAthleteAnalysis(athleteId: string, days: 7 | 15 | 30): Promise<AthleteAnalysis> {
  const workouts = await completedWorkouts(athleteId);
  const user = getSessionUser();
  const athleteName = user?.sub === athleteId ? user.name || 'Sua evolução' : user ? await readAthleteSourceName(user.sub, athleteId) || 'Análise do atleta' : 'Análise do atleta';
  const endDay = dayOffset(localDay(new Date().toISOString()), 1);
  const currentStartDay = dayOffset(endDay, -days);
  const previousStartDay = dayOffset(currentStartDay, -days);
  const measurements: MeasurementChartData[] = constants.MEASUREMENT_DEFINITIONS.map((definition) => {
    const points = (from: string, to: string) => workouts.flatMap((workout) => {
      const day = workout.performedAt ? localDay(workout.performedAt) : '';
      if (day < from || day >= to) return [];
      return preliminaryMeasurements(workout).filter((row) => row.key === definition.key).map((row) => ({ day, value: row.value, consideredSets: workout.executions.filter((set) => set.status === 'completed' && set.setType !== 'contingencia_offline').length }));
    });
    const currentPeriod = points(currentStartDay, endDay);
    const previousPeriod = points(previousStartDay, currentStartDay);
    const total = (rows: typeof currentPeriod) => rows.length ? (definition.aggregation === 'sum' ? rows.reduce((sum, row) => sum + row.value, 0) : rows.reduce((sum, row) => sum + row.value, 0) / rows.length) : null;
    return { measurementId: definition.key, key: definition.key, name: definition.name, icon: definition.icon, presentation: definition.presentation,
      unit: definition.unit, aggregation: definition.aggregation, currentPeriod, previousPeriod, currentTotal: total(currentPeriod), previousTotal: total(previousPeriod) };
  });
  const byExercise = new Map<number, { exerciseId: number; name: string; workoutIds: Set<string> }>();
  for (const workout of workouts) for (const row of workout.executions) {
    if (row.status !== 'completed' || row.setType === 'contingencia_offline') continue;
    const entry = byExercise.get(row.exerciseId) ?? { exerciseId: row.exerciseId, name: row.exercise.name, workoutIds: new Set<string>() };
    entry.workoutIds.add(workout.id);
    byExercise.set(row.exerciseId, entry);
  }
  return { athleteName,
    days, period: { currentStartDay, previousStartDay, endDay }, measurements, lifetime: lifetime(workouts),
    exercises: [...byExercise.values()].map((row) => ({ exerciseId: row.exerciseId, name: row.name, totalWorkouts: row.workoutIds.size })).sort((a,b) => b.totalWorkouts - a.totalWorkouts || a.name.localeCompare(b.name)) };
}

async function calculateExerciseAnalysis(athleteId: string, exerciseId: number, period: 7 | 15 | 30 | '3m'): Promise<ExerciseAnalysis> {
  const workouts = await completedWorkouts(athleteId);
  const monthsAgo = new Date();
  monthsAgo.setMonth(monthsAgo.getMonth() - 3);
  const days = period === '3m' ? Math.max(1, Math.round((Date.now() - monthsAgo.getTime()) / 86_400_000)) : period;
  const endDay = dayOffset(localDay(new Date().toISOString()), 1);
  const currentStart = dayOffset(endDay, -days);
  const previousStart = dayOffset(currentStart, -days);
  const selected = workouts.filter((workout) => workout.executions.some((set) => set.exerciseId === exerciseId));
  const value = (key: string): PeriodValue => ({ current: periodValue(selected, key, currentStart, endDay, exerciseId), previous: periodValue(selected, key, previousStart, currentStart, exerciseId) });
  return { period: String(period) as ExerciseAnalysis['period'], indicators: { averageRpe: value('average-rpe'), adherence: value('workout-adherence'), rpeAdherence: value('effort-adherence') }, lifetime: lifetime(workouts, exerciseId) };
}
