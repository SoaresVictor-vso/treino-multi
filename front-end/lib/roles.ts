/** Espelho do enum Role do back-end. Mantenha em sincronia com back-end/src/common/enums/role.enum.ts */
export enum Role {
  ORG_ADMIN = "org:admin",
  ORG_SUPPORT = "org:support",
  TENANT_ADMIN = "tenant:admin",
  STANDALONE_USER = "standalone:user",
  ALL = "*", // Role especial para rotas públicas, que aceita qualquer usuário autenticado
}
