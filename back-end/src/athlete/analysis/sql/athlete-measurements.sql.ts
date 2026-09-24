import { localDay, periodCte } from './period.sql';

export const measurementsSql = `${periodCte},
daily AS (
  SELECT wm.measurement_id, p.period, ${localDay} AS day,
    CASE
      WHEN m.key = 'effort-adherence' AND SUM(wm.considered_sets) > 0
        THEN SUM(wm.value * wm.considered_sets) / SUM(wm.considered_sets)
      WHEN m.aggregation = 'average' THEN AVG(wm.value)
      ELSE SUM(wm.value)
    END AS value,
    SUM(wm.considered_sets) AS "consideredSets"
  FROM periods p JOIN workouts w ON w.athlete_id = $1 AND can_read_athlete_workout(w.id, $2::uuid)
    AND w.status = 'completed' AND ${localDay} >= p.start_day AND ${localDay} < p.end_day
  JOIN workout_measurements wm ON wm.workout_id = w.id
  JOIN measurements m ON m.id = wm.measurement_id
  WHERE m.key <> 'effort-adherence' OR wm.considered_sets > 0
  GROUP BY wm.measurement_id, p.period, ${localDay}, m.key, m.aggregation
)
SELECT m.id AS "measurementId", m.name, m.icon, m.presentation,
  m.key, m.unit, m.aggregation, d.period, d.day::text AS day, d.value,
  d."consideredSets"
FROM measurements m JOIN daily d ON d.measurement_id = m.id
WHERE m.active = true
ORDER BY m.name, d.period, d.day`;
