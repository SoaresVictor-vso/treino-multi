import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePersonDocumentNullable1785726000000
	implements MigrationInterface
{
	name = 'MakePersonDocumentNullable1785726000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "persons" ALTER COLUMN "document" DROP NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "persons" ALTER COLUMN "document" SET NOT NULL`,
		);
	}
}
