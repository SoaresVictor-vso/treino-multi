import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { athleteAccessSql } from '../athlete/analysis/sql/analysis-access.sql';

export interface ReviewContext {
  allowed: boolean;
  exercise: {
    id: number;
    name: string;
    metrics: { id: number; name: string; symbol: string; fieldType: string }[];
  } | null;
  athleteName: string | null;
}

export interface SummaryRow extends ReviewContext {
  history: {
    workoutId: string;
    workoutName: string;
    performedAt: Date;
    day: string;
    executionId: string;
    metric1: string | null;
    metric2: string | null;
    predictedRm: string | null;
  }[];
  currentRp: { value: string; measuredAt: Date } | null;
}

export interface WorkoutRow {
  id: string;
  workoutName: string;
  performedAt: Date;
  position: number;
  setType: string;
  metric1: string | null;
  metric2: string | null;
  predictedRm: string | null;
  note: string | null;
}

export interface WorkoutsRow extends ReviewContext {
  rows: WorkoutRow[];
}

export interface LatestRow extends ReviewContext {
  rows: {
    workoutId: string;
    workoutName: string;
    performedAt: Date;
    metric1: string | null;
    metric2: string | null;
    predictedRm: string | null;
    setType: string;
    note: string | null;
  }[];
}

// $1 actor, $2 athlete, $3 exercise. Each endpoint adds its own data CTEs.
const contextCte = `WITH athlete AS MATERIALIZED (${athleteAccessSql.replaceAll('$1', '$2')}),
context AS MATERIALIZED (
  SELECT can_read_athlete_profile($2::uuid, $1::uuid) AS allowed,
    (SELECT name FROM athlete) AS "athleteName",
    CASE WHEN x.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', x.id, 'name', x.name, 'metrics',
      CASE WHEN m2.id IS NULL THEN jsonb_build_array(
        jsonb_build_object('id', m1.id, 'name', m1.name, 'symbol', m1.symbol, 'fieldType', m1.field_type)
      ) ELSE jsonb_build_array(
        jsonb_build_object('id', m1.id, 'name', m1.name, 'symbol', m1.symbol, 'fieldType', m1.field_type),
        jsonb_build_object('id', m2.id, 'name', m2.name, 'symbol', m2.symbol, 'fieldType', m2.field_type)
      ) END) END AS exercise
  FROM (SELECT 1) anchor
  LEFT JOIN exercises x ON x.id = $3 AND x.deleted_at IS NULL
  LEFT JOIN metrics m1 ON m1.id = x.metric_1_id
  LEFT JOIN metrics m2 ON m2.id = x.metric_2_id
)`;

const eligibleCte = `, eligible AS MATERIALIZED (
  SELECT w.id AS "workoutId", w.template_name AS "workoutName", w.performed_at AS "performedAt",
    e.id AS "executionId", e.position, e.set_type AS "setType",
    e.performed_metric_1 AS "metric1", e.performed_metric_2 AS "metric2",
    e.predicted_rm AS "predictedRm", e.performed_note AS note
  FROM context c
  JOIN workouts w ON c.allowed AND c.exercise IS NOT NULL
    AND w.athlete_id = $2::uuid AND w.status = 'completed'
    AND can_read_athlete_workout(w.id, $1::uuid)
  JOIN executions e ON e.workout_id = w.id AND e.exercise_id = $3 AND e.status = 'completed'
)`;

const result = (extra: string) => `SELECT c.allowed, c.exercise, c."athleteName", ${extra} FROM context c`;

const summarySql = `${contextCte}${eligibleCte},
  history AS (
    SELECT "workoutId", "workoutName", "performedAt", "performedAt"::date::text AS day,
      "executionId", "metric1", "metric2", "predictedRm", position
    FROM eligible WHERE "performedAt" BETWEEN $4::timestamptz AND $5::timestamptz
  ), current_rp AS (
    SELECT pr.value, pr.measured_at AS "measuredAt"
    FROM context c JOIN personal_records pr ON c.allowed AND c.exercise IS NOT NULL
      AND pr.athlete_id = $2::uuid AND pr.exercise_id = $3
      AND can_read_personal_record(pr.id, $1::uuid)
    ORDER BY pr.measured_at DESC LIMIT 1
  )
${result(`(SELECT COALESCE(jsonb_agg(to_jsonb(h) - 'position' ORDER BY h."performedAt", h.position), '[]'::jsonb) FROM history h) AS history,
  (SELECT to_jsonb(r) FROM current_rp r) AS "currentRp"`)}`;

const workoutsSql = `${contextCte}${eligibleCte},
  selected_workouts AS (
    SELECT "workoutId", max("performedAt") AS "performedAt"
    FROM eligible
    WHERE "performedAt" BETWEEN $4::timestamptz AND $5::timestamptz
    GROUP BY "workoutId" ORDER BY "performedAt" DESC LIMIT $6 OFFSET $7
  ), workout_rows AS (
    SELECT e."workoutId" AS id, e."workoutName", e."performedAt", e.position,
      e."setType", e."metric1", e."metric2", e."predictedRm", e.note
    FROM selected_workouts w JOIN eligible e ON e."workoutId" = w."workoutId"
  )
${result(`(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r."performedAt" DESC, r.position), '[]'::jsonb) FROM workout_rows r) AS rows`)}`;

const latestSql = `${contextCte}${eligibleCte},
  latest_workout AS (SELECT max("performedAt") AS "performedAt" FROM eligible),
  latest_rows AS (
    SELECT e."workoutId", e."workoutName", e."performedAt", e."metric1",
      e."metric2", e."predictedRm", e."setType", e.note, e.position
    FROM eligible e JOIN latest_workout l ON e."performedAt" = l."performedAt"
  )
${result(`(SELECT COALESCE(jsonb_agg(to_jsonb(r) - 'position' ORDER BY r.position), '[]'::jsonb) FROM latest_rows r) AS rows`)}`;

@Injectable()
export class ExerciseReviewsProvider {
  constructor(private readonly dataSource: DataSource) {}

  async summary(actorId: string, athleteId: string, exerciseId: number, from: string, to: string) {
    const [row] = await this.dataSource.query<SummaryRow[]>(summarySql, [actorId, athleteId, exerciseId, from, to]);
    return row;
  }

  async workouts(actorId: string, athleteId: string, exerciseId: number, from: string, to: string, limit: number, offset: number) {
    const [row] = await this.dataSource.query<WorkoutsRow[]>(workoutsSql, [actorId, athleteId, exerciseId, from, to, limit, offset]);
    return row;
  }

  async latest(actorId: string, athleteId: string, exerciseId: number) {
    const [row] = await this.dataSource.query<LatestRow[]>(latestSql, [actorId, athleteId, exerciseId]);
    return row;
  }
}
