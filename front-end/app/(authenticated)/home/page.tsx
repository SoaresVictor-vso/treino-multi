'use client';
import ClientWorkouts from '@/components/home/ClientWorkouts';
import TrainerWorkouts from '@/components/home/TrainerWorkouts';
import { useSession } from '@/hooks/useSession';
import { Role } from '@/lib/roles';
import { isAthleteAppUser } from '@/lib/landing';

export default function Home() {
	const user = useSession();
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
