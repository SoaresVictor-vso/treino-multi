'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import React from 'react';
import * as icons from 'react-icons/ri';
import { clearAuthCookie } from '@/lib/auth';
import { NavItemPublic } from '@/lib/navigation';

export default function Sidebar({
	items,
	mobileOpen,
	onMobileClose,
}: {
	items: NavItemPublic[];
	mobileOpen: boolean;
	onMobileClose: () => void;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [collapsed, setCollapsed] = useState(true);

	function handleLogout() {
		clearAuthCookie();
		router.push('/login');
	}

	function navigationContent(compact: boolean, mobile = false) {
		return (
			<>
				<div className="flex items-center justify-between border-b-4 border-outline-variant px-3 py-4">
					{(!compact || mobile) && (
						<span className="truncate text-xl font-bold tracking-tight">Treino Multi</span>
					)}
					{!mobile && (
						<button
							onClick={() => setCollapsed((value) => !value)}
							className="ml-auto rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
							aria-label={compact ? 'Abrir menu' : 'Fechar menu'}
						>
							{React.createElement(
								(compact ? icons.RiMenuUnfoldLine : icons.RiMenuFoldLine) as React.ElementType,
								{ className: 'h-5 w-5 text-primary' },
							)}
						</button>
					)}
					{mobile && (
						<button
							onClick={onMobileClose}
							className="ml-auto rounded-lg p-2 text-primary transition-colors hover:bg-surface-variant"
							aria-label="Fechar menu"
						>
							<icons.RiCloseLine className="h-6 w-6" />
						</button>
					)}
				</div>

				<nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="Navegação principal">
					{items.map((item) => {
						const isActive = pathname.startsWith(item.href);
						const rawIcon = icons[item.icon as keyof typeof icons] || icons.RiFileForbidLine;
						return (
							<Link
								key={item.href}
								href={item.href}
								title={compact ? item.label : undefined}
								onClick={mobile ? onMobileClose : undefined}
								className={
									'flex items-center gap-3 rounded px-4 py-3' +
									(isActive
										? ' scale-[0.98] border-r-2 border-primary bg-surface-variant/10 font-bold text-primary transition-transform'
										: ' font-medium text-secondary-fixed-dim transition-colors duration-200 hover:bg-surface-variant hover:text-primary')
								}
							>
								{React.createElement(rawIcon as React.ElementType, { className: 'h-5 w-5 shrink-0' })}
								{!compact && <span className="ps-1 text-xl">{item.label}</span>}
							</Link>
						);
					})}
				</nav>

				<div className="border-t border-gray-700 px-2 py-4">
					<button
						onClick={handleLogout}
						title={compact ? 'Sair' : undefined}
						className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xl font-medium transition-colors hover:text-white ${compact ? 'justify-center' : ''}`}
					>
						{React.createElement(icons.RiLogoutBoxRLine as React.ElementType, {
							className: 'h-5 w-5 shrink-0 text-primary',
						})}
						{!compact && 'Sair'}
					</button>
				</div>
			</>
		);
	}

	return (
		<>
			<aside className={`${collapsed ? 'w-16' : 'w-64'} sticky top-0 hidden h-screen min-h-0 shrink-0 flex-col bg-surface-container transition-all duration-300 lg:flex`}>
				{navigationContent(collapsed)}
			</aside>
			{mobileOpen && (
				<aside
					id="mobile-navigation"
					className="fixed inset-0 z-[60] flex h-screen w-screen flex-col bg-surface-container lg:hidden"
					aria-label="Menu de navegação"
				>
					{navigationContent(false, true)}
				</aside>
			)}
		</>
	);
}
