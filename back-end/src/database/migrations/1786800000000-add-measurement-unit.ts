import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeasurementUnit1786800000000 implements MigrationInterface {
	name = 'AddMeasurementUnit1786800000000';
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "measurements" ADD "unit" varchar(20)`);
		await queryRunner.query(
			`ALTER TABLE "measurements" ADD "aggregation" varchar(10) NOT NULL DEFAULT 'sum'`,
		);
		await queryRunner.query(`UPDATE "measurements" SET "unit" = CASE "key"
			WHEN 'tonnage' THEN 'kg' WHEN 'duration' THEN 's'
			WHEN 'average-pace' THEN 's/m'
			WHEN 'effort-adherence' THEN '%' WHEN 'workout-adherence' THEN '%'
			ELSE NULL END`);
		await queryRunner.query(`UPDATE "measurements" SET "aggregation" = 'average'
			WHERE "key" IN ('average-pace', 'average-rpe', 'effort-adherence', 'workout-adherence')`);
		await queryRunner.query(
			`UPDATE "measurements" SET "formula" = $1, "value_formula" = $2 WHERE "key" = 'workout-adherence'`,
			[
				'curr.points = curr.points + completed * (1 + metricsMatch); curr.count = curr.count + 1',
				'(curr.points / (2 * curr.count)) * 100',
			],
		);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "measurements" SET "formula" = $1, "value_formula" = $2 WHERE "key" = 'workout-adherence'`,
			[
				'curr.completed = curr.completed + (completed === 1) * (prescribedMetric1 > 0) * (performedMetric1 === prescribedMetric1) * (((hasMetric2 === 0) + ((hasMetric2 === 1) * (prescribedMetric2 > 0) * (performedMetric2 === prescribedMetric2))) > 0); curr.count = curr.count + 1',
				'(curr.completed / curr.count) * 100',
			],
		);
		await queryRunner.query(
			`ALTER TABLE "measurements" DROP COLUMN "aggregation"`,
		);
		await queryRunner.query(`ALTER TABLE "measurements" DROP COLUMN "unit"`);
	}
}
