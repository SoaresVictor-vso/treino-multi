import { localDay, periodCte } from './period.sql';

export const measurementsSql = `${periodCte},
daily AS (
  SELECT wm.measurement_id, p.period, ${localDay} AS day,
    CASE WHEN m.aggregation = 'average' THEN AVG(wm.value) ELSE SUM(wm.value) END AS value
  FROM periods p JOIN workouts w ON w.athlete_id = $1 AND w.tenant_id = $2
    AND w.status = 'completed' AND ${localDay} >= p.start_day AND ${localDay} < p.end_day
  JOIN workout_measurements wm ON wm.workout_id = w.id
  JOIN measurements m ON m.id = wm.measurement_id
  GROUP BY wm.measurement_id, p.period, ${localDay}, m.aggregation
)
SELECT m.id AS "measurementId", m.name, m.icon, m.presentation,
  m.unit, m.aggregation, d.period, d.day::text AS day, d.value
FROM measurements m JOIN daily d ON d.measurement_id = m.id
WHERE m.active = true
ORDER BY m.name, d.period, d.day`;
