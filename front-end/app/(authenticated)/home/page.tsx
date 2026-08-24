import ClientWorkouts from '@/components/home/ClientWorkouts';
import TrainerWorkouts from '@/components/home/TrainerWorkouts';
import { getServerSessionUser } from '@/lib/auth.server';
import { Role } from '@/lib/roles';

export default async function Home() {
	const user = await getServerSessionUser();
	const showClientWorkouts = user?.roles.includes(Role.TENANT_CLIENT) ?? false;
	const showTrainerWorkouts =
		user?.roles.some((role) =>
			[
				Role.TENANT_ADMIN,
				Role.TENANT_TRAINER,
				Role.TENANT_TRAINER_MASTER,
			].includes(role),
		) ?? false;

	if (!showClientWorkouts && !showTrainerWorkouts) return null;

	return showTrainerWorkouts ? (
		<TrainerWorkouts
			showAllAthletes={
				user?.roles.some((role) =>
					[Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
				) ?? false
			}
		/>
	) : (
		<ClientWorkouts />
	);
}
