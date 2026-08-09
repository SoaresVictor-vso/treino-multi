import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSingleInProgressWorkoutPerAthlete1786100000000 implements MigrationInterface {
	name = 'AddSingleInProgressWorkoutPerAthlete1786100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_workouts_athlete_in_progress" ON "workouts" ("athlete_id") WHERE "status" = 'in_progress'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "UQ_workouts_athlete_in_progress"`);
	}
}
