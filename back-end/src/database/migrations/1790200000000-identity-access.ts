import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive identity and association migration. Existing rows and workout ids are retained. */
export class IdentityAccess1790200000000 implements MigrationInterface {
  name = 'IdentityAccess1790200000000';

  public async up(q: QueryRunner): Promise<void> {
    const collisions = await q.query(`SELECT lower(btrim(email)) AS normalized FROM persons
      WHERE email IS NOT NULL GROUP BY lower(btrim(email)) HAVING count(*) > 1 LIMIT 1`);
    if (collisions.length) throw new Error('Existing person emails collide after normalization; resolve before migrating');
    const mixedRoles = await q.query(`SELECT u.id FROM users u JOIN user_roles athlete
      ON athlete.user_id=u.id AND athlete.role='tenant:client' AND athlete.deleted_at IS NULL
      JOIN user_roles staff ON staff.user_id=u.id AND staff.role<>'tenant:client' AND staff.deleted_at IS NULL
      WHERE u.tenant_id IS NOT NULL LIMIT 1`);
    if (mixedRoles.length) throw new Error('Existing athlete and staff roles share a tenant user; split the contexts before migrating');
    const duplicateAthletes = await q.query(`SELECT u.person_id FROM users u JOIN user_roles role
      ON role.user_id=u.id AND role.role='tenant:client' AND role.deleted_at IS NULL
      WHERE u.deleted_at IS NULL GROUP BY u.person_id HAVING count(DISTINCT u.id)>1 LIMIT 1`);
    if (duplicateAthletes.length) throw new Error('A person has multiple athlete users; consolidate identity before migrating');
    await q.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    await q.query(`UPDATE persons SET email = lower(btrim(email)) WHERE email IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_person_email_normalized ON persons (lower(btrim(email))) WHERE email IS NOT NULL`);
    await q.query(`CREATE FUNCTION reject_person_email_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.email IS DISTINCT FROM OLD.email THEN RAISE EXCEPTION 'Person email is immutable'; END IF;
      RETURN NEW; END $$`);
    await q.query(`CREATE TRIGGER trg_person_email_immutable BEFORE UPDATE ON persons
      FOR EACH ROW EXECUTE FUNCTION reject_person_email_change()`);
    await q.query(`CREATE TYPE oauth_provider_enum AS ENUM ('google')`);
    await q.query(`CREATE TABLE external_identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider oauth_provider_enum NOT NULL, subject varchar NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(provider, subject), UNIQUE(user_id, provider)
    )`);
    await q.query(`CREATE TABLE session_families (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_hash varchar NOT NULL UNIQUE, remember_me boolean NOT NULL,
      absolute_expires_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`ALTER TABLE refresh_tokens ADD COLUMN family_hash varchar`);
    await q.query(`ALTER TABLE refresh_tokens ADD COLUMN consumed_at timestamptz`);
    await q.query(`CREATE UNIQUE INDEX uq_refresh_token_hash ON refresh_tokens(token_hash)`);
    await q.query(`CREATE INDEX ix_refresh_family ON refresh_tokens(family_hash)`);
    await q.query(`CREATE TYPE athlete_tenant_status_enum AS ENUM ('pending','active','rejected','expired','cancelled')`);
    await q.query(`CREATE TYPE athlete_read_scope_enum AS ENUM ('PRESCRIBED_BY_TENANT','PRESCRIBED_BY_TENANT_LIFETIME','TENANT_AND_ATHLETE','ALL_WORKOUTS')`);
    await q.query(`CREATE TABLE athlete_tenant_associations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      invited_email varchar,
      status athlete_tenant_status_enum NOT NULL, scope athlete_read_scope_enum NOT NULL DEFAULT 'PRESCRIBED_BY_TENANT',
      invited_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
      accepted_at timestamptz, started_at timestamptz, ended_at timestamptz,
      invited_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      accepted_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      ended_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX uq_athlete_tenant_open ON athlete_tenant_associations(athlete_id,tenant_id) WHERE status IN ('pending','active')`);
    await q.query(`CREATE INDEX ix_athlete_tenant_history ON athlete_tenant_associations(tenant_id, invited_at DESC)`);
    await q.query(`CREATE TABLE athlete_invite_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operator_id uuid NOT NULL REFERENCES users(id),
      tenant_id uuid NOT NULL REFERENCES tenants(id), origin_ip varchar,
      email_hmac varchar NOT NULL, result varchar NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX ix_athlete_invite_attempts_actor ON athlete_invite_attempts(operator_id,created_at DESC)`);
    await q.query(`CREATE INDEX ix_athlete_invite_attempts_tenant ON athlete_invite_attempts(tenant_id,created_at DESC)`);
    await q.query(`CREATE INDEX ix_athlete_invite_attempts_ip ON athlete_invite_attempts(origin_ip,created_at DESC)`);
    await q.query(`INSERT INTO athlete_tenant_associations(athlete_id,tenant_id,status,invited_at,expires_at,accepted_at,started_at,accepted_by_user_id)
      SELECT u.id,u.tenant_id,'active',u.created_at,u.created_at + interval '7 days',u.created_at,u.created_at,u.id
      FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.role='tenant:client' AND ur.deleted_at IS NULL
      WHERE u.tenant_id IS NOT NULL AND u.deleted_at IS NULL`);
    await q.query(`ALTER TABLE athlete_trainer_associations ADD COLUMN athlete_tenant_association_id uuid REFERENCES athlete_tenant_associations(id) ON DELETE RESTRICT`);
    await q.query(`UPDATE athlete_trainer_associations a SET athlete_tenant_association_id = ata.id
      FROM athlete_tenant_associations ata WHERE ata.athlete_id=a.athlete_id
      AND ata.tenant_id=(SELECT tenant_id FROM users WHERE id=a.treinador_id) AND ata.status='active'`);
    // Legacy active trainer links without a matching active episode cannot be
    // represented by the new model. Drop only those links; retain workouts and records.
    const orphanedTrainerLinks = await q.query(`DELETE FROM athlete_trainer_associations
      WHERE data_fim IS NULL AND athlete_tenant_association_id IS NULL RETURNING id`);
    if (orphanedTrainerLinks.length) {
      console.warn(`Removed ${orphanedTrainerLinks.length} unmappable legacy trainer association(s)`);
    }
    await q.query(`DROP INDEX IF EXISTS "UQ_athlete_trainer_active"`);
    await q.query(`CREATE UNIQUE INDEX uq_trainer_athlete_episode_active ON athlete_trainer_associations(athlete_tenant_association_id,treinador_id) WHERE data_fim IS NULL`);
    await q.query(`ALTER TABLE workouts ADD COLUMN origin varchar NOT NULL DEFAULT 'tenant'`);
    await q.query(`ALTER TABLE workouts ADD CONSTRAINT ck_workout_origin CHECK (origin IN ('tenant','athlete'))`);
    await q.query(`ALTER TABLE workouts ADD COLUMN athlete_tenant_association_id uuid REFERENCES athlete_tenant_associations(id) ON DELETE RESTRICT`);
    await q.query(`UPDATE workouts w SET athlete_tenant_association_id=ata.id FROM athlete_tenant_associations ata
      WHERE ata.athlete_id=w.athlete_id AND ata.tenant_id=w.tenant_id AND ata.status='active'`);
    await q.query(`UPDATE workouts SET origin='athlete' WHERE created_by=athlete_id`);
    await q.query(`ALTER TABLE workouts ALTER COLUMN tenant_id DROP NOT NULL`);
    await q.query(`UPDATE workouts SET tenant_id=NULL WHERE origin='athlete'`);
    await q.query(`ALTER TABLE personal_records ADD COLUMN origin varchar NOT NULL DEFAULT 'tenant'`);
    await q.query(`ALTER TABLE personal_records ADD CONSTRAINT ck_personal_record_origin CHECK (origin IN ('tenant','athlete'))`);
    await q.query(`ALTER TABLE personal_records ADD COLUMN athlete_tenant_association_id uuid REFERENCES athlete_tenant_associations(id) ON DELETE RESTRICT`);
    await q.query(`UPDATE personal_records pr SET athlete_tenant_association_id=ata.id
      FROM athlete_tenant_associations ata WHERE ata.athlete_id=pr.athlete_id AND ata.tenant_id=pr.tenant_id AND ata.status='active'`);
    await q.query(`UPDATE personal_records SET origin='athlete' WHERE created_by=athlete_id`);
    await q.query(`ALTER TABLE personal_records ALTER COLUMN tenant_id DROP NOT NULL`);
    await q.query(`UPDATE personal_records SET tenant_id=NULL WHERE origin='athlete'`);
    const unassigned = await q.query(`SELECT 'workout' AS kind FROM workouts WHERE origin='tenant' AND athlete_tenant_association_id IS NULL
      UNION ALL SELECT 'record' AS kind FROM personal_records WHERE origin='tenant' AND athlete_tenant_association_id IS NULL
      UNION ALL SELECT 'trainer' AS kind FROM athlete_trainer_associations WHERE data_fim IS NULL AND athlete_tenant_association_id IS NULL
      LIMIT 1`);
    if (unassigned.length) throw new Error(`Legacy ${unassigned[0].kind} cannot be assigned to an athlete-tenant episode`);
    await q.query(`CREATE FUNCTION reject_training_origin_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.origin IS DISTINCT FROM OLD.origin OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
        OR NEW.athlete_tenant_association_id IS DISTINCT FROM OLD.athlete_tenant_association_id THEN
        RAISE EXCEPTION 'Training origin is immutable'; END IF;
      RETURN NEW; END $$`);
    await q.query(`CREATE TRIGGER trg_workout_origin_immutable BEFORE UPDATE ON workouts
      FOR EACH ROW EXECUTE FUNCTION reject_training_origin_change()`);
    await q.query(`CREATE TRIGGER trg_record_origin_immutable BEFORE UPDATE ON personal_records
      FOR EACH ROW EXECUTE FUNCTION reject_training_origin_change()`);
    await q.query(`UPDATE users u SET tenant_id=NULL, context='standalone'
      WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='tenant:client' AND ur.deleted_at IS NULL)`);
    await q.query(`CREATE FUNCTION can_read_athlete_workout(p_workout uuid, p_actor uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (
        SELECT 1 FROM workouts w JOIN users actor ON actor.id=p_actor AND actor.is_active=true AND actor.deleted_at IS NULL
        WHERE w.id=p_workout AND (w.athlete_id=actor.id OR EXISTS (
          SELECT 1 FROM athlete_tenant_associations ata
          WHERE ata.athlete_id=w.athlete_id AND ata.tenant_id=actor.tenant_id AND ata.status='active'
            AND (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL
              AND r.role IN ('tenant:admin','tenant:trainer-master')) OR
              (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL AND r.role='tenant:trainer')
                AND EXISTS (SELECT 1 FROM athlete_trainer_associations ta WHERE ta.athlete_tenant_association_id=ata.id
                  AND ta.treinador_id=actor.id AND ta.data_fim IS NULL)))
            AND (ata.scope='ALL_WORKOUTS'
              OR (ata.scope='PRESCRIBED_BY_TENANT_LIFETIME' AND w.origin='tenant' AND w.tenant_id=ata.tenant_id)
              OR (ata.scope='TENANT_AND_ATHLETE' AND w.origin='athlete')
              OR (w.origin='tenant' AND w.athlete_tenant_association_id=ata.id))
        ))
      ) $$`);
    await q.query(`CREATE FUNCTION can_prescribe_athlete(p_athlete uuid, p_actor uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (SELECT 1 FROM users actor JOIN athlete_tenant_associations ata
        ON ata.tenant_id=actor.tenant_id AND ata.athlete_id=p_athlete AND ata.status='active'
        WHERE actor.id=p_actor AND actor.is_active=true AND actor.deleted_at IS NULL
          AND (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL
            AND r.role IN ('tenant:admin','tenant:trainer-master')) OR
            (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL AND r.role='tenant:trainer')
              AND EXISTS (SELECT 1 FROM athlete_trainer_associations ta WHERE ta.athlete_tenant_association_id=ata.id
                AND ta.treinador_id=actor.id AND ta.data_fim IS NULL)))) $$`);
    await q.query(`CREATE FUNCTION can_read_athlete_profile(p_athlete uuid, p_actor uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (SELECT 1 FROM users actor WHERE actor.id=p_actor AND actor.is_active=true AND actor.deleted_at IS NULL
        AND (actor.id=p_athlete OR EXISTS (SELECT 1 FROM athlete_tenant_associations ata
          WHERE ata.athlete_id=p_athlete AND ata.tenant_id=actor.tenant_id AND ata.status='active'
            AND (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL
              AND r.role IN ('tenant:admin','tenant:trainer-master')) OR
              (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=actor.id AND r.deleted_at IS NULL AND r.role='tenant:trainer')
                AND EXISTS (SELECT 1 FROM athlete_trainer_associations ta WHERE ta.athlete_tenant_association_id=ata.id
                  AND ta.treinador_id=actor.id AND ta.data_fim IS NULL)))))) $$`);
    await q.query(`CREATE FUNCTION can_read_personal_record(p_record uuid, p_actor uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (SELECT 1 FROM personal_records pr JOIN users actor ON actor.id=p_actor AND actor.is_active=true
        WHERE pr.id=p_record AND pr.deleted_at IS NULL AND (pr.athlete_id=actor.id OR EXISTS (
          SELECT 1 FROM athlete_tenant_associations ata WHERE ata.athlete_id=pr.athlete_id
            AND ata.tenant_id=actor.tenant_id AND ata.status='active'
            AND can_read_athlete_profile(pr.athlete_id,p_actor)
            AND (ata.scope='ALL_WORKOUTS'
              OR (ata.scope='PRESCRIBED_BY_TENANT_LIFETIME' AND pr.origin='tenant' AND pr.tenant_id=ata.tenant_id)
              OR (ata.scope='TENANT_AND_ATHLETE' AND pr.origin='athlete')
              OR (pr.origin='tenant' AND pr.athlete_tenant_association_id=ata.id))))) $$`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Downgrade is intentionally refused: dropping history could remove access evidence.
    throw new Error('IdentityAccess migration is additive and requires a reviewed restore from backup');
  }
}
