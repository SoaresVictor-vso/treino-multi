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

	[Role.TENANT_CLIENT]: [
		Permission.AUTH_LOGIN,
		Permission.AUTH_LOGOUT,
		Permission.AUTH_REFRESH_TOKEN,
		Permission.EXERCISES_READ,
	],

	[Role.TENANT_TRAINER]: [
		Permission.AUTH_LOGIN,
		Permission.AUTH_LOGOUT,
		Permission.AUTH_REFRESH_TOKEN,
		Permission.WORKOUT_TEMPLATES_READ,
		Permission.WORKOUT_TEMPLATES_CREATE,
		Permission.WORKOUT_TEMPLATES_UPDATE,
		Permission.WORKOUT_TEMPLATES_DELETE,
		Permission.EXERCISES_READ,
		Permission.ATHLETE_READ,
	],

	[Role.TENANT_TRAINER_MASTER]: [],
	[Role.TENANT_ADMIN]: [],
};

ROLE_PERMISSIONS[Role.TENANT_TRAINER_MASTER] = [
	...(ROLE_PERMISSIONS[Role.TENANT_TRAINER] ?? []),
	Permission.WORKOUT_TEMPLATES_READ_TENANT,
	Permission.WORKOUT_TEMPLATES_CREATE,
	Permission.WORKOUT_TEMPLATES_UPDATE_TENANT,
	Permission.WORKOUT_TEMPLATES_DELETE_TENANT,
	Permission.ATHLETE_MANAGE,
];

ROLE_PERMISSIONS[Role.TENANT_ADMIN] = [
	...ROLE_PERMISSIONS[Role.TENANT_TRAINER_MASTER],
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
];

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
