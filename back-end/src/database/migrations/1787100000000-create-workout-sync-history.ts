import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkoutSyncHistory1787100000000 implements MigrationInterface {
  name = 'CreateWorkoutSyncHistory1787100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TYPE execution_set_type_enum ADD VALUE IF NOT EXISTS 'contingencia_offline'");
    await queryRunner.query('ALTER TABLE executions ADD COLUMN adherence_snapshot jsonb');
    await queryRunner.query("ALTER TABLE workouts ADD COLUMN offline_conflict_copy boolean NOT NULL DEFAULT false");
    await queryRunner.query('DROP INDEX "UQ_workouts_athlete_in_progress"');
    await queryRunner.query("CREATE UNIQUE INDEX \"UQ_workouts_athlete_in_progress\" ON workouts(athlete_id) WHERE status = 'in_progress' AND offline_conflict_copy = false");
    await queryRunner.query(`
      CREATE TABLE workout_sync_scopes (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope varchar(40) NOT NULL,
        revision bigint NOT NULL DEFAULT 0,
        min_cursor bigint NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, scope)
      );
      CREATE TABLE workout_sync_history (
        user_id uuid NOT NULL,
        scope varchar(40) NOT NULL,
        revision bigint NOT NULL,
        workout_id uuid NOT NULL,
        entity varchar(40) NOT NULL,
        entity_id text NOT NULL,
        kind varchar(10) NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, scope, revision),
        FOREIGN KEY (user_id, scope) REFERENCES workout_sync_scopes(user_id, scope) ON DELETE CASCADE
      );
      CREATE INDEX workout_sync_history_retention ON workout_sync_history(created_at);
      CREATE TABLE workout_sync_versions (
        workout_id uuid PRIMARY KEY REFERENCES workouts(id) ON DELETE CASCADE,
        revision bigint NOT NULL DEFAULT 0
      );
      INSERT INTO workout_sync_versions(workout_id, revision)
        SELECT id, 1 FROM workouts;
      CREATE TABLE workout_sync_operations (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operation_id uuid NOT NULL,
        workout_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, operation_id)
      );
      CREATE INDEX workout_sync_operations_retention ON workout_sync_operations(created_at);
    `);
    await queryRunner.query(`
      CREATE FUNCTION record_workout_sync_change() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        athlete uuid;
        target uuid;
        next_revision bigint;
        data jsonb;
      BEGIN
        data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
        IF TG_TABLE_NAME = 'workouts' THEN
          target := (data->>'id')::uuid;
          athlete := (data->>'athlete_id')::uuid;
        ELSE
          target := (data->>'workout_id')::uuid;
          SELECT athlete_id INTO athlete FROM workouts WHERE id = target;
          IF athlete IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
        END IF;
        IF TG_TABLE_NAME <> 'workouts' OR TG_OP <> 'DELETE' THEN
          INSERT INTO workout_sync_versions(workout_id, revision) VALUES (target, 1)
          ON CONFLICT (workout_id) DO UPDATE SET revision = workout_sync_versions.revision + 1;
        END IF;
        INSERT INTO workout_sync_scopes(user_id, scope, revision)
          VALUES (athlete, 'workouts', 1)
          ON CONFLICT (user_id, scope) DO UPDATE
          SET revision = workout_sync_scopes.revision + 1
          RETURNING revision INTO next_revision;
        INSERT INTO workout_sync_history(user_id, scope, revision, workout_id, entity, entity_id, kind, payload)
          VALUES (athlete, 'workouts', next_revision, target, TG_TABLE_NAME,
            CASE WHEN TG_TABLE_NAME = 'workouts' THEN target::text ELSE data->>'id' END,
            CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END, data);
        RETURN COALESCE(NEW, OLD);
      END $$;
      CREATE TRIGGER workouts_sync_history AFTER INSERT OR UPDATE OR DELETE ON workouts
        FOR EACH ROW EXECUTE FUNCTION record_workout_sync_change();
      CREATE TRIGGER executions_sync_history AFTER INSERT OR UPDATE OR DELETE ON executions
        FOR EACH ROW EXECUTE FUNCTION record_workout_sync_change();
      CREATE TRIGGER workout_notes_sync_history AFTER INSERT OR UPDATE OR DELETE ON workout_exercise_notes
        FOR EACH ROW EXECUTE FUNCTION record_workout_sync_change();
      CREATE TRIGGER workout_measurements_sync_history AFTER INSERT OR UPDATE OR DELETE ON workout_measurements
        FOR EACH ROW EXECUTE FUNCTION record_workout_sync_change();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE workouts SET status = 'scheduled' WHERE offline_conflict_copy = true AND status = 'in_progress'");
    await queryRunner.query('DROP INDEX "UQ_workouts_athlete_in_progress"');
    await queryRunner.query("CREATE UNIQUE INDEX \"UQ_workouts_athlete_in_progress\" ON workouts(athlete_id) WHERE status = 'in_progress'");
    await queryRunner.query('ALTER TABLE workouts DROP COLUMN offline_conflict_copy');
    await queryRunner.query('ALTER TABLE executions DROP COLUMN adherence_snapshot');
    await queryRunner.query(`
      DROP TRIGGER workout_measurements_sync_history ON workout_measurements;
      DROP TRIGGER workout_notes_sync_history ON workout_exercise_notes;
      DROP TRIGGER executions_sync_history ON executions;
      DROP TRIGGER workouts_sync_history ON workouts;
      DROP FUNCTION record_workout_sync_change();
      DROP TABLE workout_sync_operations;
      DROP TABLE workout_sync_versions;
      DROP TABLE workout_sync_history;
      DROP TABLE workout_sync_scopes;
    `);
  }
}
