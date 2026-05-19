import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsedTokenToPasswordChangeLogs1777334000000
  implements MigrationInterface
{
  name = 'AddUsedTokenToPasswordChangeLogs1777334000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_change_logs" ADD "used_token" character varying`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_password_change_logs_used_token" ON "password_change_logs" ("used_token") WHERE "used_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_password_change_logs_used_token"`,
    );

    await queryRunner.query(
      `ALTER TABLE "password_change_logs" DROP COLUMN "used_token"`,
    );
  }
}
