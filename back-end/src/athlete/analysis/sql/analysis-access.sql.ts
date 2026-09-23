export const athleteAccessSql = `SELECT u.tenant_id AS "tenantId", p.name,
  EXISTS (SELECT 1 FROM athlete_trainer_associations a WHERE a.athlete_id = u.id
    AND a.treinador_id = $2 AND a.data_fim IS NULL) AS "isTrainer"
FROM users u JOIN persons p ON p.id = u.person_id
WHERE u.id = $1 AND u.deleted_at IS NULL`;
