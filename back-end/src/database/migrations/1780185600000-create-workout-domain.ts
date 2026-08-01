import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkoutDomain1780185600000 implements MigrationInterface {
  name = 'CreateWorkoutDomain1780185600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "metric_field_type_enum" AS ENUM ('int', 'decimal', 'time')`);
    await queryRunner.query(`CREATE TABLE "metrics" ("id" SERIAL NOT NULL, "name" character varying(10) NOT NULL, "symbol" character varying(6) NOT NULL, "field_type" "metric_field_type_enum" NOT NULL, CONSTRAINT "UQ_metrics_name" UNIQUE ("name"), CONSTRAINT "PK_metrics" PRIMARY KEY ("id"))`);
    await queryRunner.query(`INSERT INTO "metrics" ("name", "field_type", "symbol") VALUES ('repeticoes', 'int', 'reps'), ('peso', 'decimal', 'kg'), ('tempo', 'time', 's'), ('distancia', 'int', 'm'), ('ritmo', 'time', 'min/km'), ('Percentual', 'decimal', '%')`);
    await queryRunner.query(`CREATE TABLE "exercises" ("id" SERIAL NOT NULL, "name" character varying(50) NOT NULL, "description" text NOT NULL DEFAULT '', "tenant_id" uuid DEFAULT NULL, "metric_1_id" integer NOT NULL, "metric_2_id" integer, "visual_url" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_exercises" PRIMARY KEY ("id"))`);
    await queryRunner.query(`INSERT INTO "exercises" ("name", "description", "tenant_id", "metric_1_id", "metric_2_id", "visual_url") SELECT seed."name", '', NULL, metric_1."id", metric_2."id", NULL FROM (VALUES ('Agachamento', 'reps', 'kg'), ('Supino', 'reps', 'kg'), ('Levantamento Terra', 'reps', 'kg'), ('Corrida', 'm', 's')) AS seed("name", "metric_1_symbol", "metric_2_symbol") INNER JOIN "metrics" metric_1 ON metric_1."symbol" = seed."metric_1_symbol" INNER JOIN "metrics" metric_2 ON metric_2."symbol" = seed."metric_2_symbol"`);
    await queryRunner.query(`CREATE TABLE "workout_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_workout_templates" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "activities" ("id" SERIAL NOT NULL, "workout_template_id" uuid NOT NULL, "exercise_id" integer NOT NULL, "metric_1" numeric, "metric_2" numeric, "type_1" character varying(1) NOT NULL DEFAULT 'v', "type_2" character varying(1), "pse" numeric NOT NULL, "rest_duration" integer, "note" text, CONSTRAINT "CHK_activities_type_1" CHECK ("type_1" = 'v'), CONSTRAINT "CHK_activities_type_2" CHECK ("type_2" IS NULL OR "type_2" IN ('p', 'v')), CONSTRAINT "PK_activities" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "exercises" ADD CONSTRAINT "FK_exercises_metric_1" FOREIGN KEY ("metric_1_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "exercises" ADD CONSTRAINT "FK_exercises_metric_2" FOREIGN KEY ("metric_2_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "workout_templates" ADD CONSTRAINT "FK_workout_templates_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "workout_templates" ADD CONSTRAINT "FK_workout_templates_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "workout_templates" ADD CONSTRAINT "FK_workout_templates_updater" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "activities" ADD CONSTRAINT "FK_activities_template" FOREIGN KEY ("workout_template_id") REFERENCES "workout_templates"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "activities" ADD CONSTRAINT "FK_activities_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TABLE "workout_templates"`);
    await queryRunner.query(`DROP TABLE "exercises"`);
    await queryRunner.query(`DROP TABLE "metrics"`);
    await queryRunner.query(`DROP TYPE "metric_field_type_enum"`);
  }
}
