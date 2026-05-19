/**
 * Constantes do usuário de sistema.
 *
 * Este usuário é responsável por todas as operações automatizadas
 * do sistema (bootstrap, revogações, logs internos).
 * A senha é definida exclusivamente via variável de ambiente SYS_USER_PASSWORD
 * e deve ser gerada com: openssl rand -base64 32
 */
export const SYSTEM_USER_EMAIL = 'sys.user@viso.dev.br';
export const SYSTEM_USER_NAME = 'Sistema';
