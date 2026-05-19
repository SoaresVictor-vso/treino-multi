import { Permission } from './permission.enum';
import { Role } from './role.enum';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ORG_ADMIN]: Object.values(Permission),

  [Role.ORG_SUPPORT]: [
    Permission.USER_IMPERSONATE,
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.LOG_READ,
  ],

  [Role.TENANT_ADMIN]: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_PASSWORD_RESET,
    Permission.TENANT_READ,
    Permission.FINANCIAL_INVOICES_READ,
    Permission.FINANCIAL_REPORTS_READ,
    Permission.ATTENDANCE_TICKETS_READ,
    Permission.ATTENDANCE_TICKETS_CREATE,
    Permission.ATTENDANCE_TICKETS_UPDATE,
    Permission.LOG_READ,
  ],

  [Role.STANDALONE_USER]: [
    Permission.AUTH_LOGIN,
    Permission.AUTH_LOGOUT,
    Permission.AUTH_REFRESH_TOKEN,
  ],
};

/**
 * Retorna a união das permissões de todas as roles fornecidas.
 */
export function resolvePermissions(roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    perms.forEach((p) => set.add(p));
  }
  return Array.from(set);
}
