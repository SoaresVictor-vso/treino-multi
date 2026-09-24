'use client';
import ExerciseCatalogPage from '@/components/exercises/ExerciseCatalogPage';
import { useSession } from '@/hooks/useSession';
import { Role } from '@/lib/roles';

export default function ExercisesPage() {
	const user = useSession();
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
