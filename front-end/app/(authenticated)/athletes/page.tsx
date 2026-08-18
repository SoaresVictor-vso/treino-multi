import AthletesClient from './AthletesClient';
import { getServerSessionUser } from '@/lib/auth.server';
import { Role } from '@/lib/roles';

export default async function AthletesPage() {
	const user = await getServerSessionUser();
	const roles = user?.roles ?? [];

	return (
		<AthletesClient
			canManage={roles.some((role) =>
				[Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(
					role,
				),
			)}
			canAssignWorkouts={roles.some((role) =>
				[
					Role.ORG_ADMIN,
					Role.TENANT_ADMIN,
					Role.TENANT_TRAINER_MASTER,
					Role.TENANT_TRAINER,
				].includes(role),
			)}
			canRegisterPersonalRecord={roles.some((role) =>
				[
					Role.ORG_ADMIN,
					Role.ORG_SUPPORT,
					Role.TENANT_ADMIN,
					Role.TENANT_TRAINER_MASTER,
					Role.TENANT_TRAINER,
				].includes(role),
			)}
		/>
	);
}
