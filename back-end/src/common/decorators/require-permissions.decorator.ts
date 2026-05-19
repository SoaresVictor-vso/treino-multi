import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';

/** Chave de metadata utilizada pelo PermissionsGuard */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Restringe o acesso a usuários que possuam TODAS as permissões listadas.
 * As permissões efetivas são calculadas em runtime pelo PermissionsGuard
 * a partir da união das roles em request.user.roles usando ROLE_PERMISSIONS.
 *
 * Exemplo:
 *   @RequirePermissions(Permission.TENANT_CREATE)
 *   @Post('tenants')
 *   createTenant() { ... }
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
