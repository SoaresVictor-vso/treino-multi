import { Role } from './roles';

const MANAGEMENT_ROLES: Role[] = [
	Role.ORG_ADMIN,
	Role.ORG_SUPPORT,
	Role.TENANT_ADMIN,
	Role.TENANT_TRAINER,
	Role.TENANT_TRAINER_MASTER,
];

/**
 * Um usuário que também administra ou prescreve treinos mantém o painel de
 * gestão como tela principal. O app é a experiência principal do aluno.
 */
export function isAthleteAppUser(roles: Role[]): boolean {
	return (
		roles.includes(Role.TENANT_CLIENT) &&
		!roles.some((role) => MANAGEMENT_ROLES.includes(role))
	);
}

export function getLandingPathForRoles(roles: Role[]): '/app' | '/home' {
	return isAthleteAppUser(roles) ? '/app' : '/home';
}
