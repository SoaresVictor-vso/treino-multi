'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { workoutsService, type MyWorkout } from '@/api/services/workouts';
import ErrorBox from '@/components/ui/ErrorBox';

function formatScheduledDate(date: string | null) {
	if (!date) return 'Disponível para realizar';

	return new Intl.DateTimeFormat('pt-BR', {
		dateStyle: 'long',
	}).format(new Date(`${date}`));
}

const workoutStatusPresentation = {
	pending: {
		label: 'Pendente',
		className: 'bg-secondary-container text-on-secondary-container',
	},
	scheduled: {
		label: 'Agendado',
		className: 'bg-primary-container text-on-primary-container',
	},
	in_progress: {
		label: 'Em andamento',
		className: 'bg-tertiary-container text-on-tertiary-container',
	},
} satisfies Record<MyWorkout['status'], { label: string; className: string }>;

export default function ClientWorkouts() {
	const [workouts, setWorkouts] = useState<MyWorkout[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		void workoutsService.findMine().then((response) => {
			if (!isMounted) return;
			if (response.error) setError(response.error);
			else setWorkouts(response.data ?? []);
			setIsLoading(false);
		});

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<section
			className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-7"
			aria-labelledby="my-workouts-title"
		>
			<div className="max-w-2xl">
				<p className="type-label-caps text-primary-fixed">Minha rotina</p>
				<h1
					id="my-workouts-title"
					className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-3xl lg:text-4xl"
				>
					Meus treinos
				</h1>
			</div>

			{isLoading ? (
				<p className="type-body-md text-on-surface-variant">
					Carregando seus treinos...
				</p>
			) : error ? (
				<ErrorBox message={error} />
			) : workouts.length === 0 ? (
				<div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:p-6">
					<p className="type-headline-md">Nenhum treino disponível</p>
					<p className="type-body-md mt-2 text-on-surface-variant">
						Quando um treino for disponibilizado, ele aparecerá aqui.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
					{workouts.map((workout) => {
						const status = workoutStatusPresentation[workout.status];

						return (
							<Link
								key={workout.id}
								href={`/training/${workout.id}`}
								className="flex min-w-0 flex-col rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary-fixed hover:bg-surface-container sm:p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed"
								aria-label={`Abrir treino ${workout.templateName}, ${status.label}`}
							>
								<div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
									<h2 className="type-headline-md break-words">
										{workout.templateName}
									</h2>
									<span
										className={`type-label-caps shrink-0 rounded-full px-2 py-1 ${status.className}`}
									>
										{status.label}
									</span>
								</div>
								{workout.templateDescription && (
									<p className="type-body-md mt-3 break-words text-on-surface-variant">
										{workout.templateDescription}
									</p>
								)}
								<p className="type-body-md mt-5 pt-1 text-primary-fixed sm:mt-auto sm:pt-5">
									{formatScheduledDate(workout.scheduledDate)}
								</p>
							</Link>
						);
					})}
				</div>
			)}
		</section>
	);
}
