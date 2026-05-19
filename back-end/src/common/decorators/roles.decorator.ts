import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/** Chave de metadata utilizada pelo RolesGuard */
export const ROLES_KEY = 'roles';

/**
 * Restringe o acesso a usuários que possuam PELO MENOS UMA das roles listadas.
 * A verificação é feita em runtime pelo RolesGuard contra request.user.roles.
 *
 * Exemplo:
 *   @Roles(Role.ORG_ADMIN, Role.TENANT_ADMIN)
 *   @Get('users')
 *   listUsers() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
