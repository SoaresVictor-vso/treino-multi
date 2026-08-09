'use client';

import { NavItemPublic } from '@/lib/navigation';
import { usePathname } from 'next/navigation';
import { RiCloseLine, RiMenuLine } from 'react-icons/ri';

export default function Header({
	navItems,
	mobileMenuOpen,
	onMobileMenuToggle,
}: {
	navItems: NavItemPublic[];
	mobileMenuOpen: boolean;
	onMobileMenuToggle: () => void;
}) {
	const pathname = usePathname();
	const navItem = navItems.find((item) => item.href === pathname);

	return (
		<div className="sticky top-0 z-50 flex h-16 w-full items-center border-b-4 border-outline-variant bg-background px-4 lg:px-6">
			<button
				onClick={onMobileMenuToggle}
				className="rounded-lg p-2 text-primary transition-colors hover:bg-surface-variant lg:hidden"
				aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
				aria-controls="mobile-navigation"
				aria-expanded={mobileMenuOpen}
			>
				{mobileMenuOpen ? <RiCloseLine className="h-6 w-6" /> : <RiMenuLine className="h-6 w-6" />}
			</button>
			{navItem && <h1 className="ml-3 text-lg font-bold lg:ml-0">{navItem.label}</h1>}
		</div>
	);
}
