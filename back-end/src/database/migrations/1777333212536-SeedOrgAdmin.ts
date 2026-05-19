import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  SYSTEM_USER_EMAIL,
  SYSTEM_USER_NAME,
} from '../../common/constants/system.constants';

/**
 * Seed: cria o usuário org:admin e o usuário de sistema a partir das variáveis de ambiente.
 * Idempotente: verifica se os registros já existem antes de inserir.
 *
 * Variáveis necessárias:
 *   ORG_ADMIN_EMAIL      — e-mail do administrador da organização
 *   ORG_ADMIN_PASSWORD   — senha do administrador
 *   ORG_NAME             — nome da organização
 *   SYS_USER_PASSWORD    — senha do usuário de sistema
 *                          (gerar com: openssl rand -hex 32)
 */
export class SeedOrgAdmin1777333212536 implements MigrationInterface {
  name = 'SeedOrgAdmin1777333212536';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ORG_ADMIN_EMAIL;
    const password = process.env.ORG_ADMIN_PASSWORD;
    const orgName = process.env.ORG_NAME;
    const sysPassword = process.env.SYS_USER_PASSWORD;

    if (!email || !password) {
      console.warn(
        '[Seed] ORG_ADMIN_EMAIL ou ORG_ADMIN_PASSWORD não definidos — seed ignorado.',
      );
      return;
    }

    if (!sysPassword) {
      console.warn(
        '[Seed] SYS_USER_PASSWORD não definido — usuário de sistema não será criado.',
      );
    }

    // Pre-compute hashes before opening any query so the pg client
    // is never asked to run a new query while one is already in flight.
    const passwordHash = await bcrypt.hash(password, 12);
    const sysPasswordHash = sysPassword ? await bcrypt.hash(sysPassword, 12) : null;

    // ── org:admin ────────────────────────────────────────────────────────────
    const existing = await queryRunner.query(
      `SELECT id FROM persons WHERE email = $1 LIMIT 1`,
      [email],
    );

    if (existing.length === 0) {
      const [person] = await queryRunner.query(
        `INSERT INTO persons (name, email, document) VALUES ($1, $2, $3) RETURNING id`,
        [orgName, email, '00000000000'],
      );

      const [user] = await queryRunner.query(
        `INSERT INTO users (person_id, tenant_id, context, password_hash, is_active)
         VALUES ($1, NULL, 'organization', $2, true) RETURNING id`,
        [person.id, passwordHash],
      );

      await queryRunner.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
        [user.id, 'org:admin'],
      );

      console.log(`[Seed] org:admin criado com email: ${email}`);
    } else {
      console.log('[Seed] org:admin já existe — ignorado.');
    }

    // ── sistema ───────────────────────────────────────────────────────────────
    if (sysPassword) {
      const existingSys = await queryRunner.query(
        `SELECT id FROM persons WHERE email = $1 LIMIT 1`,
        [SYSTEM_USER_EMAIL],
      );

      if (existingSys.length === 0) {
        const [sysPerson] = await queryRunner.query(
          `INSERT INTO persons (name, email, document) VALUES ($1, $2, $3) RETURNING id`,
          [SYSTEM_USER_NAME, SYSTEM_USER_EMAIL, '00000000001'],
        );

        await queryRunner.query(
          `INSERT INTO users (person_id, tenant_id, context, password_hash, is_active)
           VALUES ($1, NULL, 'organization', $2, false) RETURNING id`,
          [sysPerson.id, sysPasswordHash!],
        );

        console.log(`[Seed] usuário de sistema criado com email: ${SYSTEM_USER_EMAIL}`);
      } else {
        console.log('[Seed] usuário de sistema já existe — ignorado.');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove usuário de sistema
    await queryRunner.query(
      `DELETE FROM users WHERE person_id = (
        SELECT id FROM persons WHERE email = $1 LIMIT 1
      ) AND context = 'organization'`,
      [SYSTEM_USER_EMAIL],
    );
    await queryRunner.query(`DELETE FROM persons WHERE email = $1`, [SYSTEM_USER_EMAIL]);

    // Remove org:admin
    const adminEmail = process.env.ORG_ADMIN_EMAIL;
    if (!adminEmail) return;

    await queryRunner.query(
      `DELETE FROM users WHERE person_id = (
        SELECT id FROM persons WHERE email = $1 LIMIT 1
      ) AND context = 'organization'`,
      [adminEmail],
    );
    await queryRunner.query(`DELETE FROM persons WHERE email = $1`, [adminEmail]);
  }
}
