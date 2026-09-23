/** Shared calendar windows in the application's São Paulo timezone. $3 is 7, 15 or 30. */
export const periodCte = `
WITH bounds AS (
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today, $3::int AS days
), periods AS (
  SELECT 'current'::text AS period, today - (days - 1) AS start_day, today + 1 AS end_day FROM bounds
  UNION ALL
  SELECT 'previous', today - (2 * days - 1), today - (days - 1) FROM bounds
)`;

export const localDay = `(w.performed_at AT TIME ZONE 'America/Sao_Paulo')::date`;
