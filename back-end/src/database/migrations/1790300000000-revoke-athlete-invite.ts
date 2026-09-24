import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevokeAthleteInvite1790300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE athlete_tenant_status_enum ADD VALUE IF NOT EXISTS 'revoked'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing one value from an enum safely.
  }
}
