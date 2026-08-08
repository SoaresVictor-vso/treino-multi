import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
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
		<div className="flex min-h-screen">
			<Sidebar items={navItems} />
			<main className="min-w-0 flex-1 bg-background">
				<Header navItems={navItems} />
				<div className="space-y-6 p-4 sm:p-6 lg:p-10 xl:p-16">{children}</div>
			</main>
		</div>
	);
}
