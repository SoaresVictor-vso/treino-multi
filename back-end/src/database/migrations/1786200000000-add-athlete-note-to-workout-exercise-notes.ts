import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAthleteNoteToWorkoutExerciseNotes1786200000000 implements MigrationInterface {
	name = 'AddAthleteNoteToWorkoutExerciseNotes1786200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			'ALTER TABLE "workout_exercise_notes" ALTER COLUMN "note" DROP NOT NULL',
		);
		await queryRunner.query(
			'ALTER TABLE "workout_exercise_notes" ADD "athlete_note" text',
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			'ALTER TABLE "workout_exercise_notes" DROP COLUMN "athlete_note"',
		);
		await queryRunner.query(
			'DELETE FROM "workout_exercise_notes" WHERE "note" IS NULL',
		);
		await queryRunner.query(
			'ALTER TABLE "workout_exercise_notes" ALTER COLUMN "note" SET NOT NULL',
		);
	}
}
