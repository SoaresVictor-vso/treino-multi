import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkouts1785800000000 implements MigrationInterface {
	name = 'CreateWorkouts1785800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "workout_status_enum" AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'skipped', 'cancelled')`,
		);
		await queryRunner.query(
			`CREATE TYPE "execution_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'skipped')`,
		);
		await queryRunner.query(
			`CREATE TABLE "workouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "athlete_id" uuid NOT NULL, "workout_template_id" uuid, "template_name" character varying NOT NULL, "template_description" text NOT NULL DEFAULT '', "scheduled_date" date, "performed_at" TIMESTAMP WITH TIME ZONE, "status" "workout_status_enum" NOT NULL DEFAULT 'scheduled', "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workouts" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "executions" ("id" SERIAL NOT NULL, "workout_id" uuid NOT NULL, "exercise_id" integer NOT NULL, "position" integer NOT NULL, "prescribed_metric_1" numeric, "prescribed_metric_2" numeric, "metric1_type" character varying(1) NOT NULL DEFAULT 'v', "metric2_type" character varying(1), "prescribed_pse" numeric, "prescribed_rest_duration" integer, "performed_metric_1" numeric, "performed_metric_2" numeric, "performed_pse" numeric, "performed_rest_duration" integer, "performed_note" text, "status" "execution_status_enum" NOT NULL DEFAULT 'pending', "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_executions_metric1_type" CHECK ("metric1_type" = 'v'), CONSTRAINT "CHK_executions_metric2_type" CHECK ("metric2_type" IS NULL OR "metric2_type" IN ('p', 'v')), CONSTRAINT "PK_executions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_executions_workout_position" ON "executions" ("workout_id", "position")`,
		);
		await queryRunner.query(
			`CREATE TABLE "workout_exercise_notes" ("id" SERIAL NOT NULL, "workout_id" uuid NOT NULL, "exercise_id" integer NOT NULL, "note" text NOT NULL, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workout_exercise_notes" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_workout_exercise_notes_workout_exercise" ON "workout_exercise_notes" ("workout_id", "exercise_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_workouts_athlete_scheduled_date" ON "workouts" ("athlete_id", "scheduled_date")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_workouts_tenant_status_scheduled_date" ON "workouts" ("tenant_id", "status", "scheduled_date")`,
		);
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD CONSTRAINT "FK_workouts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD CONSTRAINT "FK_workouts_athlete" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD CONSTRAINT "FK_workouts_template" FOREIGN KEY ("workout_template_id") REFERENCES "workout_templates"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD CONSTRAINT "FK_workouts_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD CONSTRAINT "FK_workouts_updater" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "executions" ADD CONSTRAINT "FK_executions_workout" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE`,
		);
		await queryRunner.query(
			`ALTER TABLE "executions" ADD CONSTRAINT "FK_executions_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "FK_workout_exercise_notes_workout" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE`,
		);
		await queryRunner.query(
			`ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "FK_workout_exercise_notes_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "FK_workout_exercise_notes_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "FK_workout_exercise_notes_updater" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "workout_activities" DROP CONSTRAINT IF EXISTS "FK_workout_activities_workout"`,
		);
		await queryRunner.query(`DROP TABLE "workout_exercise_notes"`);
		await queryRunner.query(`DROP TABLE "executions"`);
		await queryRunner.query(`DROP TABLE "workouts"`);
		await queryRunner.query(`DROP TYPE "execution_status_enum"`);
		await queryRunner.query(`DROP TYPE "workout_status_enum"`);
	}
}
