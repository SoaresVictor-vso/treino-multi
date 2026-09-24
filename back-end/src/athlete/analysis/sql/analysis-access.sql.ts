export const athleteAccessSql = `SELECT p.name FROM users u JOIN persons p ON p.id=u.person_id
WHERE u.id=$1 AND u.deleted_at IS NULL`;
