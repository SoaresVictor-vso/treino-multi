'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ErrorBox from '@/components/ui/ErrorBox';
import {
	workoutsService,
	type TrainerWorkout,
} from '@/gateway/services/workouts';

const statusPresentation = {
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
	completed: {
		label: 'Finalizado',
		className: 'bg-surface-variant text-on-surface-variant',
	},
} satisfies Record<TrainerWorkout['status'], { label: string; className: string }>;

function formatDate(date: string | null, fallback: string) {
	if (!date) return fallback;
	return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
		new Date(date),
	);
}

function WorkoutSection({
	title,
	description,
	workouts,
}: {
	title: string;
	description: string;
	workouts: TrainerWorkout[];
}) {
	if (!workouts.length) return null;

	return (
		<section className="space-y-3" aria-label={title}>
			<div>
				<h2 className="text-xl font-bold">{title}</h2>
				<p className="type-body-md text-on-surface-variant">{description}</p>
			</div>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
				{workouts.map((workout) => {
					const status = statusPresentation[workout.status];
					const dateLabel =
						workout.status === 'completed'
							? `Finalizado em ${formatDate(workout.performedAt, 'data não informada')}`
							: formatDate(workout.scheduledDate, 'Disponível para realizar');
					return (
						<Link
							key={workout.id}
							href={`/training/${workout.id}`}
							className="flex min-w-0 flex-col rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary-fixed hover:bg-surface-container sm:p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed"
							aria-label={`Visualizar treino ${workout.templateName} de ${workout.athleteName}, ${status.label}`}
						>
							<div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
								<div className="min-w-0">
									<p className="type-label-caps text-primary-fixed">{workout.athleteName}</p>
									<h3 className="type-headline-md mt-1 break-words">
										{workout.templateName}
									</h3>
								</div>
								<span className={`type-label-caps shrink-0 rounded-full px-2 py-1 ${status.className}`}>
									{status.label}
								</span>
							</div>
							{workout.templateDescription && (
								<p className="type-body-md mt-3 break-words text-on-surface-variant">
									{workout.templateDescription}
								</p>
							)}
							<p className="type-body-md mt-5 pt-1 text-on-surface-variant sm:mt-auto sm:pt-5">
								{dateLabel}
							</p>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

export default function TrainerWorkouts({
	showAllAthletes = false,
}: {
	showAllAthletes?: boolean;
}) {
	const [workouts, setWorkouts] = useState<TrainerWorkout[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		void workoutsService.findTrainerWorkouts().then((response) => {
			if (!isMounted) return;
			if (!response.success) setError(response.error || 'Não foi possível carregar os treinos.');
			else setWorkouts(response.data ?? []);
			setLoading(false);
		});
		return () => {
			isMounted = false;
		};
	}, []);

	const inProgress = workouts.filter((workout) => workout.status === 'in_progress');
	const completed = workouts.filter((workout) => workout.status === 'completed');
	const pendingOrScheduled = workouts.filter((workout) =>
		['pending', 'scheduled'].includes(workout.status),
	);

	return (
		<section className="mx-auto w-full max-w-7xl space-y-7" aria-labelledby="trainer-workouts-title">
			<div className="max-w-2xl">
				<p className="type-label-caps text-primary-fixed">Acompanhamento</p>
				<h1 id="trainer-workouts-title" className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-3xl lg:text-4xl">
					{showAllAthletes ? 'Treinos dos atletas' : 'Treinos dos meus atletas'}
				</h1>
			</div>
			{loading ? (
				<p className="type-body-md text-on-surface-variant">Carregando treinos dos atletas...</p>
			) : error ? (
				<ErrorBox message={error} />
			) : workouts.length === 0 ? (
				<div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:p-6">
					<p className="type-headline-md">Nenhum treino para acompanhar</p>
					<p className="type-body-md mt-2 text-on-surface-variant">
						{showAllAthletes
							? 'Os treinos dos atletas deste tenant aparecerão aqui.'
							: 'Os treinos dos atletas vinculados aparecerão aqui.'}
					</p>
				</div>
			) : (
				<div className="space-y-7">
					<WorkoutSection title="Em progresso" description="Treinos sendo realizados agora." workouts={inProgress} />
					<WorkoutSection title="Finalizados na última semana" description="Treinos concluídos nos últimos sete dias." workouts={completed} />
					<WorkoutSection title="Pendentes e agendados" description="Treinos que ainda podem ser realizados." workouts={pendingOrScheduled} />
				</div>
			)}
		</section>
	);
}
