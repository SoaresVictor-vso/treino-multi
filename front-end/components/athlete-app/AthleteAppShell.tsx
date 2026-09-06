'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
	RiBarChartBoxLine,
	RiAddLine,
	RiHome5Line,
	RiMedalLine,
	RiPlayFill,
	RiSettings3Line,
} from 'react-icons/ri';
import { workoutsService } from '@/gateway/services/workouts';

type AthleteNavItem = {
	href: string;
	label: string;
	icon: IconType;
};

const NAV_ITEMS: AthleteNavItem[] = [
	{ href: '/app', label: 'Início', icon: RiHome5Line },
	{ href: '/app/conquistas', label: 'Conquistas', icon: RiMedalLine },
	{ href: '/app/analise', label: 'Análise', icon: RiBarChartBoxLine },
	{ href: '/app/perfil', label: 'Perfil', icon: RiSettings3Line },
];

function isActive(pathname: string, href: string) {
	return href === '/app' ? pathname === href : pathname.startsWith(href);
}

function Navigation({
	compact = false,
	runningWorkoutId,
	onCreateWorkout,
	creatingWorkout,
}: {
	compact?: boolean;
	runningWorkoutId: string | null | undefined;
	onCreateWorkout: () => void;
	creatingWorkout: boolean;
}) {
	const pathname = usePathname();
	const currentTrainingId = pathname.match(/^\/training\/([^/]+)/)?.[1] ?? null;
	const resumableWorkoutId =
		runningWorkoutId === undefined ? currentTrainingId : runningWorkoutId;
	const newWorkoutLabel = resumableWorkoutId
		? 'Retomar treino em andamento'
		: 'Criar treino e iniciar agora';
	const items = compact
		? [...NAV_ITEMS.slice(0, 2), null, ...NAV_ITEMS.slice(2)]
		: NAV_ITEMS;

	return (
		<nav
			aria-label="Navegação principal do atleta"
			className={
				compact
					? 'grid grid-cols-5 gap-1'
					: 'flex flex-col gap-1 rounded-[1.75rem] border border-white/8 bg-surface-container-low/80 p-2 shadow-2xl shadow-black/20 backdrop-blur'
			}
		>
			{items.map((item, index) => {
				if (!item) {
					return resumableWorkoutId ? (
						<Link
							key="new-workout"
							href={`/training/${resumableWorkoutId}`}
							aria-label={newWorkoutLabel}
							className="relative -mt-7 grid h-16 w-16 place-self-center place-items-center rounded-full border-[5px] border-surface-container-low bg-primary-container text-on-primary-fixed shadow-[0_10px_30px_rgba(195,244,0,0.35)] transition hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(195,244,0,0.48)] focus:outline-none focus:ring-2 focus:ring-primary-fixed"
						>
							{resumableWorkoutId ? <RiPlayFill size={27} aria-hidden /> : <RiAddLine size={29} aria-hidden />}
						</Link>
					) : (
						<button
							key="new-workout"
							type="button"
							onClick={onCreateWorkout}
							disabled={creatingWorkout}
							aria-label={newWorkoutLabel}
							className="relative -mt-7 grid h-16 w-16 place-self-center place-items-center rounded-full border-[5px] border-surface-container-low bg-primary-container text-on-primary-fixed shadow-[0_10px_30px_rgba(195,244,0,0.35)] transition hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(195,244,0,0.48)] focus:outline-none focus:ring-2 focus:ring-primary-fixed disabled:cursor-wait disabled:opacity-60"
						>
							<RiAddLine size={29} aria-hidden />
						</button>
					);
				}
				const active = isActive(pathname, item.href);
				const Icon = item.icon;
				return (
					<Link
						key={`${item.href}-${index}`}
						href={item.href}
						aria-current={active ? 'page' : undefined}
						className={
							compact
								? 'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold tracking-wide text-on-surface-variant transition-colors hover:bg-surface-variant/70 hover:text-primary'
								: 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/70 hover:text-primary'
						}
					>
						<Icon className={active ? 'text-primary-fixed' : undefined} size={compact ? 21 : 20} aria-hidden />
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}

export default function AthleteAppShell({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [runningWorkoutId, setRunningWorkoutId] = useState<string | null | undefined>(
		undefined,
	);
	const [creatingWorkout, setCreatingWorkout] = useState(false);
	const [creationError, setCreationError] = useState<string | null>(null);
	const createAndStartWorkout = async () => {
		setCreatingWorkout(true);
		setCreationError(null);
		const result = await workoutsService.createMine({
			activities: [],
			startImmediately: true,
		});
		if (!result.success || !result.data) {
			setCreationError(result.error || 'Não foi possível iniciar um novo treino.');
			setCreatingWorkout(false);
			return;
		}
		setRunningWorkoutId(result.data.id);
		window.dispatchEvent(new Event('workout-status-changed'));
		router.push(`/training/${result.data.id}`);
	};

	useEffect(() => {
		let active = true;
		const loadRunningWorkout = () => {
			void workoutsService.findMine().then((result) => {
				if (!active || !result.success) return;
				setRunningWorkoutId(
					result.data?.find((workout) => workout.status === 'in_progress')?.id ?? null,
				);
			});
		};
		loadRunningWorkout();
		window.addEventListener('workout-status-changed', loadRunningWorkout);
		return () => {
			active = false;
			window.removeEventListener('workout-status-changed', loadRunningWorkout);
		};
	}, []);

	return (
		<div className="min-h-screen bg-background text-on-surface">
			<div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
				<div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary-container/10 blur-3xl" />
				<div className="absolute -right-40 top-1/3 h-80 w-80 rounded-full bg-secondary-container/30 blur-3xl" />
			</div>
			<div className="relative mx-auto flex min-h-screen w-full max-w-7xl">
				<aside className="hidden w-64 shrink-0 flex-col border-r border-white/7 px-5 py-7 lg:flex">
					<Link href="/app" className="mb-10 flex items-center gap-3 px-3">
						<span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-container text-lg font-black text-on-primary-fixed shadow-[0_0_28px_rgba(195,244,0,0.25)]">
							G
						</span>
						<span>
							<strong className="block text-base tracking-tight">Gym Latte</strong>
							<span className="text-xs text-on-surface-variant">Área do atleta</span>
						</span>
					</Link>
					<Navigation
						runningWorkoutId={runningWorkoutId}
						onCreateWorkout={() => void createAndStartWorkout()}
						creatingWorkout={creatingWorkout}
					/>
					{runningWorkoutId ? <Link
						href={`/training/${runningWorkoutId}`}
						className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary-container/40 bg-primary-container/10 px-4 text-sm font-bold text-primary-fixed transition hover:bg-primary-container hover:text-on-primary-fixed"
					>
						<RiPlayFill size={18} aria-hidden /> Retomar treino
					</Link> : <button
						type="button"
						onClick={() => void createAndStartWorkout()}
						disabled={creatingWorkout}
						className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary-container/40 bg-primary-container/10 px-4 text-sm font-bold text-primary-fixed transition hover:bg-primary-container hover:text-on-primary-fixed disabled:cursor-wait disabled:opacity-60"
					>
						<RiAddLine size={20} aria-hidden /> Criar e iniciar
					</button>}
					<p className="mt-auto px-3 text-xs leading-5 text-on-surface-variant">
						Seu espaço para treinar com intenção e acompanhar sua evolução.
					</p>
				</aside>

				<main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-8 sm:pt-8 lg:px-12 lg:pb-10">
					{creationError && <p role="alert" className="mb-5 rounded-xl border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error">{creationError}</p>}
					{children}
				</main>
			</div>
			<div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-surface-container-low/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
				<div className="mx-auto max-w-lg">
					<Navigation
						compact
						runningWorkoutId={runningWorkoutId}
						onCreateWorkout={() => void createAndStartWorkout()}
						creatingWorkout={creatingWorkout}
					/>
				</div>
			</div>
		</div>
	);
}
