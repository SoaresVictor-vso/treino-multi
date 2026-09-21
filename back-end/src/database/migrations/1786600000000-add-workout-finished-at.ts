import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutFinishedAt1786600000000 implements MigrationInterface {
	name = 'AddWorkoutFinishedAt1786600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "workouts" ADD COLUMN "finished_at" TIMESTAMP WITH TIME ZONE`);
		// Existing terminal workouts predate this column. updated_at is their best
		// available completion timestamp and becomes the backwards-compatible default.
		await queryRunner.query(`UPDATE "workouts" SET "finished_at" = "updated_at"`);
		await queryRunner.query(`ALTER TABLE "workouts" ALTER COLUMN "finished_at" SET DEFAULT CURRENT_TIMESTAMP`);
		await queryRunner.query(`
			UPDATE "workout_measurements" AS measurement
			SET "value" = EXTRACT(EPOCH FROM (workout."finished_at" - workout."performed_at"))
			FROM "workouts" AS workout
			WHERE measurement."workout_id" = workout."id"
				AND measurement."snapshot"->>'key' = 'duration'
				AND workout."performed_at" IS NOT NULL
				AND workout."finished_at" IS NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "workouts" DROP COLUMN "finished_at"`);
	}
}
