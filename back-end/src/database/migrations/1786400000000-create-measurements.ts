import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeasurements1786400000000 implements MigrationInterface {
	name = 'CreateMeasurements1786400000000';
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "measurements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" varchar(80) NOT NULL, "name" varchar(120) NOT NULL, "active" boolean NOT NULL DEFAULT true, "metric_1_id" integer, "metric_2_id" integer, "formula" text NOT NULL, "value_formula" text NOT NULL, "static_weight" numeric NOT NULL DEFAULT 0, "dynamic_weight" numeric NOT NULL DEFAULT 0, "icon" varchar(40) NOT NULL, "presentation" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_measurements" PRIMARY KEY ("id"), CONSTRAINT "UQ_measurements_key" UNIQUE ("key"))`);
		await queryRunner.query(`ALTER TABLE "measurements" ADD CONSTRAINT "FK_measurements_metric_1" FOREIGN KEY ("metric_1_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`);
		await queryRunner.query(`ALTER TABLE "measurements" ADD CONSTRAINT "FK_measurements_metric_2" FOREIGN KEY ("metric_2_id") REFERENCES "metrics"("id") ON DELETE RESTRICT`);
		await queryRunner.query(`CREATE TABLE "workout_measurements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workout_id" uuid NOT NULL, "measurement_id" uuid NOT NULL, "value" numeric NOT NULL, "score" numeric NOT NULL, "snapshot" jsonb NOT NULL, CONSTRAINT "PK_workout_measurements" PRIMARY KEY ("id"), CONSTRAINT "UQ_workout_measurements_workout_measurement" UNIQUE ("workout_id", "measurement_id"))`);
		await queryRunner.query(`ALTER TABLE "workout_measurements" ADD CONSTRAINT "FK_workout_measurements_workout" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE`);
		await queryRunner.query(`ALTER TABLE "workout_measurements" ADD CONSTRAINT "FK_workout_measurements_measurement" FOREIGN KEY ("measurement_id") REFERENCES "measurements"("id") ON DELETE RESTRICT`);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "workout_measurements"`);
		await queryRunner.query(`DROP TABLE "measurements"`);
	}
}
