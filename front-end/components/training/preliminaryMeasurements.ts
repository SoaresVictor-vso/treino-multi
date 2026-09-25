import { constants, tools, types } from '@treino-multi/shared';
const { MEASUREMENT_DEFINITIONS } = constants;
const { createZeroState, evaluateValueFormula, executeFormula, formulaFields } = tools;
type FormulaContext = types.FormulaContext;



import type { WorkoutDetail, WorkoutExecution, WorkoutMeasurement } from '@/gateway/services/workouts';

function context(execution: WorkoutExecution): FormulaContext {
  const metric2 = execution.exercise.metric_2 ?? null;
  const prescription = execution.adherenceSnapshot ?? execution;
  const values: FormulaContext = {
    duration: null,
    rpe: execution.performedPse,
    prescribedRpe: prescription.prescribedPse,
    completed: execution.status === 'completed',
    performedMetric1: execution.performedMetric1,
    performedMetric2: execution.performedMetric2,
    prescribedMetric1: prescription.prescribedMetric1,
    prescribedMetric2: prescription.prescribedMetric2,
    hasMetric2: metric2 !== null,
    metricsMatch: prescription.prescribedMetric1 !== null && prescription.prescribedMetric1 > 0 &&
      execution.performedMetric1 === prescription.prescribedMetric1 &&
      (metric2 === null || (prescription.prescribedMetric2 !== null && prescription.prescribedMetric2 > 0 &&
        execution.performedMetric2 === prescription.prescribedMetric2)),
    performedRestDuration: execution.performedRestDuration,
    prescribedRestDuration: prescription.prescribedRestDuration,
  };
  values[execution.exercise.metric_1.name] = execution.performedMetric1;
  if (metric2) values[metric2.name] = execution.performedMetric2;
  return values;
}

export function preliminaryMeasurements(workout: WorkoutDetail, now = Date.now()): WorkoutMeasurement[] {
  const executions = workout.executions.filter((item) => !item.pendingRemoval && item.setType !== 'contingencia_offline');
  return MEASUREMENT_DEFINITIONS.flatMap((definition): WorkoutMeasurement[] => {
    if (definition.key === 'workout-adherence' && workout.createdBy === workout.athleteId) return [];
    const compatible = executions.filter((execution) => {
      if (definition.key === 'workout-adherence') return true;
      if (execution.status !== 'completed') return false;
      const values = context(execution);
      const needs = ([definition.metric1Name, definition.metric2Name] as (string | null)[]).filter((name): name is string => name !== null);
      if (!needs.every((name) => Number.isFinite(Number(values[name])) && Number(values[name]) > 0)) return false;
      if (definition.key === 'duration') return true;
      return formulaFields(definition.formula).every((field) => field === 'completed' ||
        (Number.isFinite(Number(values[field])) && Number(values[field]) > 0));
    });
    if (!compatible.length) return [];
    const curr = createZeroState();
    try {
      if (definition.key === 'duration') {
        if (!workout.performedAt) return [];
        const duration = Math.max(0, ((workout.finishedAt ? new Date(workout.finishedAt).getTime() : now) -
          new Date(workout.performedAt).getTime()) / 1000);
        executeFormula(definition.formula, curr, { ...context(compatible[0]), duration });
      } else {
        for (const execution of compatible) executeFormula(definition.formula, curr, context(execution));
      }
      return [{
        id: definition.key,
        measurementId: definition.key,
        value: evaluateValueFormula(definition.valueFormula, curr),
        score: definition.staticWeight + compatible.length * definition.dynamicWeight,
        key: definition.key,
        name: definition.name,
        icon: definition.icon,
        presentation: definition.presentation,
      }];
    } catch { return []; }
  }).sort((left, right) => right.score - left.score);
}
