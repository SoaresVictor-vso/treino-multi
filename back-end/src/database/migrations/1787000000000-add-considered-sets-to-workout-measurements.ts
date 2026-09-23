import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsideredSetsToWorkoutMeasurements1787000000000
	implements MigrationInterface
{
	name = 'AddConsideredSetsToWorkoutMeasurements1787000000000';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "workout_measurements" ADD "considered_sets" integer NOT NULL DEFAULT 0`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "workout_measurements" DROP COLUMN "considered_sets"`,
		);
	}
}
