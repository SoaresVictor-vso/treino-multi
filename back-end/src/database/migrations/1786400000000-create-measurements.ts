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
		const presentation = JSON.stringify({ containerClass: 'bg-surface-container-high border-outline-variant', iconClass: 'text-primary-fixed', valueClass: 'text-on-surface', labelClass: 'text-on-surface-variant' });
		await queryRunner.query(`INSERT INTO "measurements" ("key","name","metric_1_id","metric_2_id","formula","value_formula","static_weight","dynamic_weight","icon","presentation") VALUES
			('duration','Duração',NULL,NULL,'curr.total = curr.total + duration','curr.total',1,1,'timer',$1),
			('tonnage','Tonelagem',(SELECT id FROM metrics WHERE name = 'peso'),(SELECT id FROM metrics WHERE name = 'repeticoes'),'curr.total = curr.total + peso * repeticoes','curr.total',5,1,'dumbbell',$1),
			('average-pace','Pace médio',(SELECT id FROM metrics WHERE name = 'distancia'),(SELECT id FROM metrics WHERE name = 'tempo'),'curr.distance = curr.distance + distancia; curr.duration = curr.duration + tempo','curr.duration / curr.distance',3,1,'gauge',$1),
			('average-rpe','RPE médio',NULL,NULL,'curr.total = curr.total + rpe; curr.count = curr.count + 1','curr.total / curr.count',2,1,'activity',$1),
			('effort-adherence','Aderência de esforço',NULL,NULL,'curr.total = curr.total + (rpe / prescribedRpe) * 100; curr.count = curr.count + 1','curr.total / curr.count',4,1,'target',$1),
			('workout-adherence','Aderência no treino',NULL,NULL,'curr.completed = curr.completed + (completed === 1) * (prescribedMetric1 > 0) * (performedMetric1 === prescribedMetric1) * (((hasMetric2 === 0) + ((hasMetric2 === 1) * (prescribedMetric2 > 0) * (performedMetric2 === prescribedMetric2))) > 0); curr.count = curr.count + 1','(curr.completed / curr.count) * 100',4,1,'check-circle',$1)`, [presentation]);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "workout_measurements"`);
		await queryRunner.query(`DROP TABLE "measurements"`);
	}
}
