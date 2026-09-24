'use client';
import Link from 'next/link';
import { RiArrowRightLine, RiGoogleFill } from 'react-icons/ri';
import ClientWorkouts from '@/components/home/ClientWorkouts';
import TrainerWorkouts from '@/components/home/TrainerWorkouts';
import { useSession } from '@/hooks/useSession';
import { Role } from '@/lib/roles';

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

	return (
		<div className="space-y-6">
			<section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
				<div className="flex items-center gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-container text-primary-fixed">
						<RiGoogleFill size={20} aria-hidden />
					</span>
					<div>
						<h2 className="font-semibold text-primary">Conta Google</h2>
						<p className="mt-1 text-sm text-on-surface-variant">
							Vincule ou desvincule o Google nos métodos de login.
						</p>
					</div>
				</div>
				<Link
					href="/login-methods"
					className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30"
				>
					Gerenciar conta Google
					<RiArrowRightLine size={18} aria-hidden />
				</Link>
			</section>
			{showTrainerWorkouts ? (
				<TrainerWorkouts
					showAllAthletes={
						user?.roles.some((role) =>
							[Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
						) ?? false
					}
				/>
			) : showClientWorkouts ? (
				<ClientWorkouts />
			) : null}
		</div>
	);
}
