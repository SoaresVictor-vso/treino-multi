'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { NavItemPublic } from '@/lib/navigation';

export default function AuthenticatedShell({
	children,
	navItems,
}: {
	children: React.ReactNode;
	navItems: NavItemPublic[];
}) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="flex min-h-screen">
			<Sidebar
				items={navItems}
				mobileOpen={mobileMenuOpen}
				onMobileClose={() => setMobileMenuOpen(false)}
			/>
			<main className="min-w-0 flex-1 bg-background">
				<Header
					navItems={navItems}
					mobileMenuOpen={mobileMenuOpen}
					onMobileMenuToggle={() => setMobileMenuOpen((open) => !open)}
				/>
				<div className="space-y-6 p-4 sm:p-6 lg:p-10 xl:p-16">{children}</div>
			</main>
		</div>
	);
}
