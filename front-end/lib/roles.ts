/** Espelho do enum Role do back-end. Mantenha em sincronia com back-end/src/common/enums/role.enum.ts */
export enum Role {
  ORG_ADMIN = "org:admin",
  ORG_SUPPORT = "org:support",
  TENANT_ADMIN = "tenant:admin",
  // STANDALONE_USER = "standalone:user",
  TENANT_CLIENT = "tenant:client",
  TENANT_TRAINER = "tenant:trainer",
  TENANT_TRAINER_MASTER = "tenant:trainer-master",
  ALL = "*", // Role especial para rotas públicas, que aceita qualquer usuário autenticado
}
