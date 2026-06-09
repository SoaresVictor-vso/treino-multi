import { Role } from "./roles";

/**
 * Mapa de permissões de rotas autenticadas.
 *
 * A chave é o prefixo do pathname (ex.: "/home").
 * O valor é o array de roles que têm acesso à rota.
 *
 * Adicione aqui cada nova página criada em app/(authenticated).
 * A middleware faz matching por prefixo, do mais específico para o mais genérico.
 */
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  "/home": [Role.ALL],
  "/dashboard": [Role.ORG_ADMIN, Role.ORG_SUPPORT, Role.TENANT_ADMIN, Role.STANDALONE_USER],
};
