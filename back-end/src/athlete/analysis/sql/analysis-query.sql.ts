import { athleteAccessSql } from './analysis-access.sql';
import {
  exercisesSql,
  exerciseLifetimeSql,
  exerciseThreeMonthIndicatorsSql,
  indicatorsSql,
  lifetimeSql,
} from './athlete-analysis.sql';
import { measurementsSql } from './athlete-measurements.sql';

// Keep each chart's SELECT independently maintainable while fetching the athlete once.
// CASE prevents chart queries from running when profile access is denied.
const chart = (sql: string) =>
  `CASE WHEN access.allowed THEN (SELECT COALESCE(jsonb_agg(row_to_json(result)), '[]'::jsonb) FROM (${sql}) result) ELSE '[]'::jsonb END`;

const access = `WITH athlete AS MATERIALIZED (${athleteAccessSql}),
access AS (SELECT EXISTS (SELECT 1 FROM athlete) AS found,
  EXISTS (SELECT 1 FROM athlete) AND can_read_athlete_profile($1::uuid, $2::uuid) AS allowed,
  (SELECT name FROM athlete) AS name)`;

export const athleteAnalysisQuery = `${access}
SELECT access.found, access.allowed, access.name,
  ${chart(measurementsSql)} AS measurements,
  ${chart(lifetimeSql)} AS lifetime,
  ${chart(exercisesSql)} AS exercises
FROM access`;

export const exerciseAnalysisQuery = (threeMonths: boolean) => {
  const indicator = threeMonths ? exerciseThreeMonthIndicatorsSql : indicatorsSql;
  const exerciseParameter = threeMonths ? '$5' : '$4';
  const exerciseLifetime = exerciseLifetimeSql.replaceAll('$3', exerciseParameter);
  return `${access}
SELECT access.found, access.allowed, access.name,
  ${chart(indicator)} AS indicators,
  ${chart(exerciseLifetime)} AS lifetime
FROM access`;
};
