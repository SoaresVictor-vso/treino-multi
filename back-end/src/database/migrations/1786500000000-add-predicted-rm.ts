import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPredictedRm1786500000000 implements MigrationInterface {
	name = 'AddPredictedRm1786500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "executions" ADD COLUMN "predicted_rm" numeric NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_executions_exercise_workout" ON "executions" ("exercise_id", "workout_id")`);
		await queryRunner.query(`CREATE INDEX "IDX_workouts_athlete_performed_at" ON "workouts" ("athlete_id", "performed_at")`);
		// Deliberately only updates eligible rows. Invalid legacy rows stay NULL and are
		// never reconsidered by read endpoints, making this migration idempotent.
		await queryRunner.query(`
			UPDATE executions e SET predicted_rm = CASE
				WHEN m1.name = 'peso' THEN e.performed_metric_1 * 36 / (37 - e.performed_metric_2)
				ELSE e.performed_metric_2 * 36 / (37 - e.performed_metric_1)
			END
			FROM workouts w, exercises x, metrics m1, metrics m2
			WHERE e.workout_id = w.id AND x.id = e.exercise_id
				AND m1.id = x.metric_1_id AND m2.id = x.metric_2_id
				AND e.predicted_rm IS NULL
				AND w.status = 'completed' AND e.status = 'completed'
				AND ((m1.name = 'peso' AND m2.name = 'repeticoes') OR (m1.name = 'repeticoes' AND m2.name = 'peso'))
				AND e.performed_metric_1 IS NOT NULL AND e.performed_metric_2 IS NOT NULL
				AND (CASE WHEN m1.name = 'repeticoes' THEN e.performed_metric_1 ELSE e.performed_metric_2 END) BETWEEN 1 AND 36
				AND (CASE WHEN m1.name = 'peso' THEN e.performed_metric_1 ELSE e.performed_metric_2 END) > 0
		`);
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_workouts_athlete_performed_at"`);
		await queryRunner.query(`DROP INDEX "IDX_executions_exercise_workout"`);
		await queryRunner.query(`ALTER TABLE "executions" DROP COLUMN "predicted_rm"`);
	}
}
