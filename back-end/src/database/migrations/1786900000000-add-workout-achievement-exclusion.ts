import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutAchievementExclusion1786900000000 implements MigrationInterface {
	name = 'AddWorkoutAchievementExclusion1786900000000';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "workouts" ADD "exclude_from_achievements" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "workouts" DROP COLUMN "exclude_from_achievements"`,
		);
	}
}
