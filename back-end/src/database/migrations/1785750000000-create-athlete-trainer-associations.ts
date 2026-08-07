import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAthleteTrainerAssociations1785750000000 implements MigrationInterface {
	name = 'CreateAthleteTrainerAssociations1785750000000';
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "athlete_trainer_associations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "athlete_id" uuid NOT NULL, "treinador_id" uuid NOT NULL, "data_inicio" date NOT NULL, "data_fim" date, "usuario_inicio_id" uuid NOT NULL, "usuario_fim_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_athlete_trainer_associations" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_athlete_trainer_active" ON "athlete_trainer_associations" ("athlete_id") WHERE "data_fim" IS NULL`);
		await queryRunner.query(`ALTER TABLE "athlete_trainer_associations" ADD CONSTRAINT "FK_athlete_trainer_athlete" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT`);
		await queryRunner.query(`ALTER TABLE "athlete_trainer_associations" ADD CONSTRAINT "FK_athlete_trainer_trainer" FOREIGN KEY ("treinador_id") REFERENCES "users"("id") ON DELETE RESTRICT`);
		await queryRunner.query(`ALTER TABLE "athlete_trainer_associations" ADD CONSTRAINT "FK_athlete_trainer_started_by" FOREIGN KEY ("usuario_inicio_id") REFERENCES "users"("id") ON DELETE RESTRICT`);
		await queryRunner.query(`ALTER TABLE "athlete_trainer_associations" ADD CONSTRAINT "FK_athlete_trainer_ended_by" FOREIGN KEY ("usuario_fim_id") REFERENCES "users"("id") ON DELETE RESTRICT`);
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "athlete_trainer_associations"`);
	}
}
