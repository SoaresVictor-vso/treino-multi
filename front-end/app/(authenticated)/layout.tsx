import AuthenticatedShell from '@/components/AuthenticatedShell';
import { getServerSessionUser } from '@/lib/auth.server';
import { getNavItemsForRoles } from '@/lib/navigation';
import { Role } from '@/lib/roles';

export default async function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getServerSessionUser();
	const navItems = getNavItemsForRoles(user?.roles ?? []);
	const canCreateExercise = !!user?.roles.some((role) =>
		[Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
	);

	return (
		<AuthenticatedShell
			navItems={navItems}
			canCreateExercise={canCreateExercise}
			isGlobal={!user?.tenantId}
		>
			{children}
		</AuthenticatedShell>
	);
}
