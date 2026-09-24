export const OAUTH_ACCOUNT_SQL = `
WITH linked AS (
  SELECT ei.user_id FROM external_identities ei
  WHERE ei.provider = $1::oauth_provider_enum AND ei.subject = $2
)
SELECT linked.user_id AS "linkedUserId", u.id AS "userId",
  u.person_id AS "personId", u.tenant_id AS "tenantId", u.context,
  p.name, p.email AS "accountEmail",
  COALESCE((SELECT jsonb_agg(ur.role) FROM user_roles ur
    WHERE ur.user_id = u.id AND ur.deleted_at IS NULL), '[]'::jsonb) AS roles,
  EXISTS(SELECT 1 FROM persons owner WHERE owner.email = $3) AS "emailExists"
FROM (SELECT 1) anchor LEFT JOIN linked ON true
LEFT JOIN users u ON u.id = linked.user_id AND u.is_active = true AND u.deleted_at IS NULL
LEFT JOIN persons p ON p.id = u.person_id`;

export const LOGOUT_SQL = `
WITH token AS (
  SELECT family_hash FROM refresh_tokens WHERE token_hash = $1 AND family_hash IS NOT NULL
), revoked_family AS (
  UPDATE session_families SET revoked_at = $2
  WHERE family_hash IN (SELECT family_hash FROM token)
  RETURNING family_hash
), revoked_tokens AS (
  UPDATE refresh_tokens SET revoked_at = $2
  WHERE family_hash IN (SELECT family_hash FROM token) AND revoked_at IS NULL
  RETURNING id
)
SELECT EXISTS(SELECT 1 FROM token) AS found`;

export const LOGIN_METHODS_SQL = `
SELECT u.password_hash IS NOT NULL AS "passwordAvailable",
  COALESCE((SELECT jsonb_agg(ei.provider) FROM external_identities ei
    WHERE ei.user_id = u.id), '[]'::jsonb) AS providers
FROM users u WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`;

export const REVOKE_REUSED_SESSION_SQL = `
WITH revoked_family AS (
  UPDATE session_families SET revoked_at = $3
  WHERE id = $1 AND family_hash = $2
  RETURNING family_hash
), revoked_tokens AS (
  UPDATE refresh_tokens SET revoked_at = $3
  WHERE family_hash IN (SELECT family_hash FROM revoked_family)
    AND revoked_at IS NULL
  RETURNING id
)
SELECT EXISTS(SELECT 1 FROM revoked_family) AS revoked`;
