'use client';
import AthletesClient from './AthletesClient';
import { useSession } from '@/hooks/useSession';
import { Role } from '@/lib/roles';

export default function AthletesPage() {
	const user = useSession();
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
