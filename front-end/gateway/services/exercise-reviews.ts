import { tools } from '@treino-multi/shared';
import { getSessionUser } from '@/lib/auth';
import { readAthleteSourceName, readVisibleWorkouts } from '@/lib/offline-contingency';
import { readCatalogRows } from '@/lib/offline-catalog';
import type { ExerciseParameter, Metric } from './parametro';
import type { WorkoutDetail, WorkoutExecution } from './workouts';

export type ExerciseReviewPoint = {
  date: string; workoutId: string; predictedRm: number | null; repetitions: number | null;
  weight: number | null; distance: number | null; duration: number | null; tonnage: number | null; pace: number | null;
};
export type ExerciseReviewSummary = {
  athleteName: string;
  exercise: { id: number; name: string; metrics: { name: string; symbol: string }[] };
  period: { from: string; to: string };
  currentRp: { value: number; measuredAt: string } | null;
  bestSet: ExerciseReviewPoint | null;
  estimatedRm: number | null;
  charts: ExerciseReviewPoint[];
};
export type ExerciseReviewSet = { position: number; setType: string; metric1: number | null; metric2: number | null; predictedRm: number | null; note: string | null };
export type ExerciseReviewWorkout = { id: string; workoutName: string; performedAt: string; sets: number; bestPredictedRm: number | null; tonnage: number | null; series: ExerciseReviewSet[] };

async function source(athleteId: string, exerciseId: number) {
  const user = getSessionUser();
  if (!user) throw new Error('Sessão indisponível.');
  if (user.sub !== athleteId && !navigator.onLine) throw new Error('É necessária conexão para visualizar a revisão do atleta.');
  const [workouts, catalog, metrics, athleteName] = await Promise.all([
    readVisibleWorkouts(user.sub), readCatalogRows<ExerciseParameter>('exercises'),
    readCatalogRows<Omit<Metric, 'id'> & { id: string }>('metrics'),
    user.sub === athleteId ? Promise.resolve(user.name ?? '') : readAthleteSourceName(user.sub, athleteId),
  ]);
  const completed = workouts.filter((workout) => workout.athleteId === athleteId && workout.status === 'completed' && workout.performedAt)
    .sort((a, b) => new Date(b.performedAt!).getTime() - new Date(a.performedAt!).getTime());
  const exercise = catalog.find((row) => Number(row.id) === exerciseId);
  const sample = completed.flatMap((workout) => workout.executions).find((row) => row.exerciseId === exerciseId);
  if (!exercise && !sample) throw new Error('Exercício não encontrado no cache local.');
  const metric1 = sample?.exercise.metric_1 ?? metrics.find((row) => Number(row.id) === exercise?.metric1Id);
  const metric2 = sample?.exercise.metric_2 ?? metrics.find((row) => Number(row.id) === exercise?.metric2Id);
  return { athleteName: athleteName ?? '', workouts: completed, exercise: {
    id: exerciseId, name: exercise?.name ?? sample!.exercise.name,
    metrics: [metric1, metric2].filter((value): value is NonNullable<typeof value> => !!value).map((value) => ({ name: value.name, symbol: value.symbol })),
  } };
}

function predicted(row: WorkoutExecution): number | null {
  return tools.predictedRmForExecution({ completed: row.status === 'completed',
    metric1Name: row.exercise.metric_1.name, metric2Name: row.exercise.metric_2?.name,
    metric1: row.performedMetric1, metric2: row.performedMetric2 });
}

function reviewDay(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function rows(workouts: WorkoutDetail[], exerciseId: number) {
  return workouts.flatMap((workout) => workout.executions.filter((row) =>
    row.exerciseId === exerciseId && row.status === 'completed' && row.setType !== 'contingencia_offline').map((row) => ({ workout, row })));
}

const result = async <T>(fn: () => Promise<T>) => {
  try { return { success: true, status: 200, data: await fn() }; }
  catch (cause) { return { success: false, status: 0, error: cause instanceof Error ? cause.message : 'Falha na leitura local.' }; }
};

export const exerciseReviewsService = {
  summary: (athleteId: string, exerciseId: number) => result<ExerciseReviewSummary>(async () => {
    const { athleteName, workouts, exercise } = await source(athleteId, exerciseId);
    const to = new Date();
    const from = new Date(to); from.setMonth(from.getMonth() - 3);
    const eligible = rows(workouts, exerciseId).filter(({ workout }) => new Date(workout.performedAt!) >= from);
    const byDay = new Map<string, ExerciseReviewPoint[]>();
    for (const { workout, row } of eligible) {
      const metric1 = row.exercise.metric_1.name;
      const metric2 = row.exercise.metric_2?.name;
      const value = (name: string) => metric1 === name ? row.performedMetric1 : metric2 === name ? row.performedMetric2 : null;
      const distance = value('distancia'), duration = value('tempo');
      const point: ExerciseReviewPoint = { date: workout.performedAt!, workoutId: workout.id,
        predictedRm: predicted(row), repetitions: value('repeticoes'), weight: value('peso'), distance, duration,
        tonnage: null, pace: distance && duration ? duration / distance : null };
      const day = reviewDay(workout.performedAt!);
      byDay.set(day, [...(byDay.get(day) ?? []), point]);
    }
    const charts = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, points]) => {
      const latest = points.at(-1)!;
      return { ...latest, date: `${day}T12:00:00.000Z`, predictedRm: Math.max(...points.map((point) => point.predictedRm ?? 0)) || null,
        tonnage: exercise.metrics.some((metric) => metric.name === 'peso') && exercise.metrics.some((metric) => metric.name === 'repeticoes')
          ? points.reduce((sum, point) => sum + Number(point.weight || 0) * Number(point.repetitions || 0), 0) : null };
    });
    const bestSet = [...charts].sort((a, b) => (b.predictedRm ?? 0) - (a.predictedRm ?? 0))[0] ?? null;
    const record = eligible.map(({ row }) => row.referencePersonalRecord).find((value) => value);
    return { athleteName, exercise,
      period: { from: from.toISOString(), to: to.toISOString() },
      currentRp: record ? { value: record.value, measuredAt: record.measuredAt } : null,
      bestSet, estimatedRm: bestSet?.predictedRm ?? null, charts };
  }),
  workouts: (athleteId: string, exerciseId: number, page = 1) => result<{ items: ExerciseReviewWorkout[]; page: number; limit: number }>(async () => {
    const { workouts, exercise } = await source(athleteId, exerciseId);
    const from = new Date(); from.setMonth(from.getMonth() - 3);
    const selected = workouts.filter((workout) => new Date(workout.performedAt!) >= from && workout.executions.some((row) => row.exerciseId === exerciseId && row.status === 'completed'));
    const items = selected.slice((page - 1) * 20, page * 20).map((workout) => {
      const series = rows([workout], exerciseId).map(({ row }) => ({ position: row.position, setType: row.setType,
        metric1: row.performedMetric1, metric2: row.performedMetric2, predictedRm: predicted(row), note: row.performedNote }));
      const weightIndex = exercise.metrics.findIndex((metric) => metric.name === 'peso');
      const repsIndex = exercise.metrics.findIndex((metric) => metric.name === 'repeticoes');
      return { id: workout.id, workoutName: workout.templateName, performedAt: workout.performedAt!, sets: series.length,
        bestPredictedRm: Math.max(...series.map((set) => set.predictedRm ?? 0)) || null,
        tonnage: weightIndex >= 0 && repsIndex >= 0 ? series.reduce((sum, set) =>
          sum + Number(weightIndex === 0 ? set.metric1 : set.metric2 || 0) * Number(repsIndex === 0 ? set.metric1 : set.metric2 || 0), 0) : null,
        series };
    });
    return { items, page, limit: 20 };
  }),
  latest: (athleteId: string, exerciseId: number) => result<{ item: Array<{ workoutId: string; workoutName: string; performedAt: string; metric1: number | null; metric2: number | null; predictedRm: number | null; setType: string; note: string | null }> | null }>(async () => {
    const { workouts } = await source(athleteId, exerciseId);
    const workout = workouts.find((item) => item.executions.some((row) => row.exerciseId === exerciseId && row.status === 'completed'));
    if (!workout) return { item: null };
    return { item: rows([workout], exerciseId).map(({ row }) => ({ workoutId: workout.id, workoutName: workout.templateName,
      performedAt: workout.performedAt!, metric1: row.performedMetric1, metric2: row.performedMetric2,
      predictedRm: predicted(row), setType: row.setType, note: row.performedNote })) };
  }),
};
