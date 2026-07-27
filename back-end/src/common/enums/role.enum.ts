export enum Role {
  // Contexto: organização principal
  ORG_ADMIN = 'org:admin',
  ORG_SUPPORT = 'org:support',

  // Contexto: tenant (empresa cliente)
  TENANT_ADMIN = 'tenant:admin',

  // STANDALONE_USER = 'standalone:user',

  TENANT_CLIENT = 'tenant:client',

  TENANT_TRAINER = 'tenant:trainer',
}
