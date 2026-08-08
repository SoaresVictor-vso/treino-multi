import ClientWorkouts from '@/components/home/ClientWorkouts';
import { getServerSessionUser } from '@/lib/auth.server';
import { Role } from '@/lib/roles';

export default async function Home() {
	const user = await getServerSessionUser();
	const showClientWorkouts = user?.roles.includes(Role.TENANT_CLIENT) ?? false;

	if (!showClientWorkouts) return null;

	return (
		<ClientWorkouts />
	);
}
