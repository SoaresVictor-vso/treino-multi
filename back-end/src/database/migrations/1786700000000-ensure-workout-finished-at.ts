import { MigrationInterface, QueryRunner } from 'typeorm';

/** Repairs environments where the previous migration version was recorded elsewhere. */
export class EnsureWorkoutFinishedAt1786700000000 implements MigrationInterface {
	name = 'EnsureWorkoutFinishedAt1786700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "finished_at" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`UPDATE "workouts" SET "finished_at" = "updated_at" WHERE "finished_at" IS NULL`);
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

	public async down(): Promise<void> {
		// The repair may run after a migration that already owns this column.
	}
}
