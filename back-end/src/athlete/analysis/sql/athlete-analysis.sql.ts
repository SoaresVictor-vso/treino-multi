import { localDay, periodCte } from './period.sql';

// Workout adherence counts prescribed sets. Exercise-level RPE adherence
// averages the valid sets for that exercise; athlete-level uses its measurement.
const indicatorBody = (dateCondition: string, exerciseParameter: string) => `,
eligible AS (
  SELECT p.period, e.status, e.prescribed_metric_1, e.prescribed_metric_2,
    e.performed_metric_1, e.performed_metric_2, e.prescribed_pse, e.performed_pse,
    exercise.metric_2_id IS NOT NULL AS has_metric_2
  FROM periods p
  JOIN workouts w ON w.athlete_id = $1 AND w.tenant_id = $2 AND w.status = 'completed'
    AND ${dateCondition}
  JOIN executions e ON e.workout_id = w.id
  JOIN exercises exercise ON exercise.id = e.exercise_id
  WHERE (${exerciseParameter}::int IS NULL OR e.exercise_id = ${exerciseParameter})
)
SELECT p.period, p.start_day::text AS "startDay", p.end_day::text AS "endDay",
  AVG(performed_pse) FILTER (WHERE status = 'completed' AND performed_pse > 0) AS "averageRpe",
  CASE WHEN COUNT(e.status) = 0 THEN NULL ELSE 100.0 * COUNT(*) FILTER (
    WHERE status = 'completed' AND prescribed_metric_1 > 0
      AND performed_metric_1 = prescribed_metric_1
      AND (NOT has_metric_2 OR (prescribed_metric_2 > 0 AND performed_metric_2 = prescribed_metric_2))
  ) / COUNT(e.status) END AS adherence,
  CASE WHEN ${exerciseParameter}::int IS NULL THEN NULL::numeric
    ELSE AVG(CASE WHEN performed_pse = prescribed_pse THEN 100.0 ELSE 0.0 END) FILTER (
    WHERE status = 'completed' AND performed_pse > 0 AND prescribed_pse > 0
  ) END AS "rpeAdherence"
FROM periods p LEFT JOIN eligible e USING (period)
GROUP BY p.period, p.start_day, p.end_day`;

export const indicatorsSql = `${periodCte}${indicatorBody(`${localDay} >= p.start_day AND ${localDay} < p.end_day`, '$4')}`;

// Uses the exact rolling window supplied to the existing exercise review charts.
// The previous window has the same elapsed duration as the current one.
export const exerciseThreeMonthIndicatorsSql = `WITH bounds AS (
  SELECT $3::timestamptz AS start_at, $4::timestamptz AS end_at
), periods AS (
  SELECT 'current'::text AS period, start_at,
    end_at, (start_at AT TIME ZONE 'America/Sao_Paulo')::date AS start_day,
    (end_at AT TIME ZONE 'America/Sao_Paulo')::date AS end_day FROM bounds
  UNION ALL
  SELECT 'previous', start_at - (end_at - start_at), start_at,
    ((start_at - (end_at - start_at)) AT TIME ZONE 'America/Sao_Paulo')::date,
    (start_at AT TIME ZONE 'America/Sao_Paulo')::date FROM bounds
)${indicatorBody('w.performed_at >= p.start_at AND w.performed_at < p.end_at', '$5')}`;

export const lifetimeSql = `WITH completed_workouts AS (
  SELECT id FROM workouts WHERE athlete_id = $1 AND tenant_id = $2 AND status = 'completed'
), completed_sets AS (
  SELECT e.*, m1.name AS metric_1_name, m2.name AS metric_2_name
  FROM completed_workouts w JOIN executions e ON e.workout_id = w.id AND e.status = 'completed'
  JOIN exercises x ON x.id = e.exercise_id
  JOIN metrics m1 ON m1.id = x.metric_1_id
  LEFT JOIN metrics m2 ON m2.id = x.metric_2_id
)
SELECT
  (SELECT SUM(wm.value) FROM completed_workouts w JOIN workout_measurements wm ON wm.workout_id = w.id
   JOIN measurements m ON m.id = wm.measurement_id WHERE m.key = 'tonnage') AS "totalTonnage",
  (SELECT COUNT(*) FROM completed_workouts) AS "totalWorkouts",
  (SELECT COALESCE(SUM(CASE WHEN metric_1_name = 'repeticoes' THEN performed_metric_1
                   WHEN metric_2_name = 'repeticoes' THEN performed_metric_2 END), 0) FROM completed_sets) AS "totalRepetitions",
  (SELECT COUNT(*) FROM completed_sets) AS "totalSets"`;

export const exercisesSql = `WITH performed AS (
  SELECT e.exercise_id, e.workout_id FROM workouts w
  JOIN executions e ON e.workout_id = w.id AND e.status = 'completed'
  WHERE w.athlete_id = $1 AND w.tenant_id = $2 AND w.status = 'completed'
)
SELECT x.id AS "exerciseId", x.name, COUNT(DISTINCT p.workout_id) AS "totalWorkouts"
FROM performed p JOIN exercises x ON x.id = p.exercise_id
GROUP BY x.id, x.name ORDER BY "totalWorkouts" DESC, x.name`;

export const exerciseLifetimeSql = `WITH performed AS (
  SELECT w.id AS workout_id, e.performed_metric_1, e.performed_metric_2
  FROM workouts w JOIN executions e ON e.workout_id = w.id
  WHERE w.athlete_id = $1 AND w.tenant_id = $2 AND w.status = 'completed'
    AND e.status = 'completed' AND e.exercise_id = $3
), exercise_metrics AS (
  SELECT m1.name AS metric_1_name, m2.name AS metric_2_name
  FROM exercises x JOIN metrics m1 ON m1.id = x.metric_1_id
  LEFT JOIN metrics m2 ON m2.id = x.metric_2_id WHERE x.id = $3
)
SELECT COUNT(performed.workout_id) AS "totalSets", COUNT(DISTINCT workout_id) AS "totalWorkouts",
  CASE WHEN metric_1_name = 'repeticoes' OR metric_2_name = 'repeticoes'
    THEN COALESCE(SUM(CASE WHEN metric_1_name = 'repeticoes' THEN performed_metric_1 ELSE performed_metric_2 END), 0) END AS "totalRepetitions",
  CASE WHEN (metric_1_name = 'peso' AND metric_2_name = 'repeticoes') OR (metric_1_name = 'repeticoes' AND metric_2_name = 'peso')
    THEN COALESCE(SUM((CASE WHEN metric_1_name = 'peso' THEN performed_metric_1 ELSE performed_metric_2 END) *
                           (CASE WHEN metric_1_name = 'repeticoes' THEN performed_metric_1 ELSE performed_metric_2 END)), 0) END AS "totalTonnage"
FROM exercise_metrics LEFT JOIN performed ON true
GROUP BY metric_1_name, metric_2_name`;
