export enum Role {
  // Contexto: organização principal
  ORG_ADMIN = 'org:admin',
  ORG_SUPPORT = 'org:support',

  // Contexto: tenant (empresa cliente)
  TENANT_ADMIN = 'tenant:admin',

  // Contexto: standalone (usuário avulso)
  STANDALONE_USER = 'standalone:user',
}
