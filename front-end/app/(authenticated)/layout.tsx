import AuthenticatedShell from '@/components/AuthenticatedShell';
import { getServerSessionUser } from '@/lib/auth.server';
import { getNavItemsForRoles } from '@/lib/navigation';

export default async function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getServerSessionUser();
	const navItems = getNavItemsForRoles(user?.roles ?? []);

	return (
		<AuthenticatedShell navItems={navItems}>{children}</AuthenticatedShell>
	);
}
