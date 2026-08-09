import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSingleInProgressWorkoutPerAthlete1786100000000 implements MigrationInterface {
	name = 'AddSingleInProgressWorkoutPerAthlete1786100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_workouts_athlete_in_progress" ON "workouts" ("athlete_id") WHERE "status" = 'in_progress'`,
		);
		await queryRunner.query(`ALTER TABLE "activities" ADD "position" integer`);
		await queryRunner.query(
			`WITH ordered_activities AS (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workout_template_id" ORDER BY "id") AS "position" FROM "activities") UPDATE "activities" AS activity SET "position" = ordered_activities."position" FROM ordered_activities WHERE activity."id" = ordered_activities."id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "activities" ALTER COLUMN "position" SET NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "activities" ADD CONSTRAINT "UQ_activities_template_position" UNIQUE ("workout_template_id", "position")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "activities" DROP CONSTRAINT "UQ_activities_template_position"`,
		);
		await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "position"`);
		await queryRunner.query(`DROP INDEX "UQ_workouts_athlete_in_progress"`);
	}
}
