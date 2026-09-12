import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionSetType1786300000000 implements MigrationInterface {
	name = 'AddExecutionSetType1786300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "execution_set_type_enum" AS ENUM ('padrao', 'aquecimento', 'dropset', 'falha')`,
		);
		await queryRunner.query(
			`ALTER TABLE "executions" ADD "set_type" "execution_set_type_enum" NOT NULL DEFAULT 'padrao'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "executions" DROP COLUMN "set_type"`);
		await queryRunner.query(`DROP TYPE "execution_set_type_enum"`);
	}
}
