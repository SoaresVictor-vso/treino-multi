import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExerciseGroupsAndPersonalRecords1785900000000 implements MigrationInterface {
	name = 'CreateExerciseGroupsAndPersonalRecords1785900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "exercise_groups" ("id" SERIAL NOT NULL, "name" character varying(80) NOT NULL, "tenant_id" uuid NOT NULL, "metric_1_id" integer NOT NULL, "metric_2_id" integer, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_exercise_groups" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "exercise_group_exercises" ("id" SERIAL NOT NULL, "exercise_group_id" integer NOT NULL, "exercise_id" integer NOT NULL, "created_by" uuid NOT NULL, "deleted_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_exercise_group_exercises" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exercise_group_exercises_active" ON "exercise_group_exercises" ("exercise_group_id", "exercise_id") WHERE "deleted_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE TABLE "personal_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "athlete_id" uuid NOT NULL, "exercise_group_id" integer, "exercise_id" integer, "value" numeric NOT NULL, "measured_at" date NOT NULL, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "CHK_personal_records_value" CHECK ("value" > 0), CONSTRAINT "CHK_personal_records_reference" CHECK (("exercise_group_id" IS NULL) <> ("exercise_id" IS NULL)), CONSTRAINT "PK_personal_records" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_personal_records_athlete_group_active" ON "personal_records" ("athlete_id", "exercise_group_id") WHERE "deleted_at" IS NULL AND "exercise_group_id" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_personal_records_athlete_exercise_active" ON "personal_records" ("athlete_id", "exercise_id") WHERE "deleted_at" IS NULL AND "exercise_group_id" IS NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_personal_records_tenant_athlete" ON "personal_records" ("tenant_id", "athlete_id")`,
		);

		await queryRunner.query(
			`ALTER TABLE "exercise_groups" ADD CONSTRAINT "FK_exercise_groups_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_groups" ADD CONSTRAINT "FK_exercise_groups_metric_1" FOREIGN KEY ("metric_1_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_groups" ADD CONSTRAINT "FK_exercise_groups_metric_2" FOREIGN KEY ("metric_2_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_groups" ADD CONSTRAINT "FK_exercise_groups_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_groups" ADD CONSTRAINT "FK_exercise_groups_updater" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_group_exercises" ADD CONSTRAINT "FK_exercise_group_exercises_group" FOREIGN KEY ("exercise_group_id") REFERENCES "exercise_groups"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_group_exercises" ADD CONSTRAINT "FK_exercise_group_exercises_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "exercise_group_exercises" ADD CONSTRAINT "FK_exercise_group_exercises_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_athlete" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_group" FOREIGN KEY ("exercise_group_id") REFERENCES "exercise_groups"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
		await queryRunner.query(
			`ALTER TABLE "personal_records" ADD CONSTRAINT "FK_personal_records_updater" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "personal_records"`);
		await queryRunner.query(`DROP TABLE "exercise_group_exercises"`);
		await queryRunner.query(`DROP TABLE "exercise_groups"`);
	}
}
