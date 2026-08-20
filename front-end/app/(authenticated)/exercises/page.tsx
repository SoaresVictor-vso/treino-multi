import ExerciseCatalogPage from '@/components/exercises/ExerciseCatalogPage';
import { getServerSessionUser } from '@/lib/auth.server';
import { Role } from '@/lib/roles';

export default async function ExercisesPage() {
	const user = await getServerSessionUser();
	const canCreateExercise = !!user?.roles.some((role) =>
		[Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
	);

	return (
		<ExerciseCatalogPage
			isGlobal={!user?.tenantId}
			canCreateExercise={canCreateExercise}
		/>
	);
}
