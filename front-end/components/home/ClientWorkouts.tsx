'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RiAddLine, RiPlayLine } from 'react-icons/ri';
import {
	workoutsService,
	type CompletedWorkout,
	type MyWorkout,
} from '@/gateway/services/workouts';
import ErrorBox from '@/components/ui/ErrorBox';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import TrainingForm, {
	type TrainingFormValues,
} from '@/components/training/TrainingForm';

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
	const router = useRouter();
	const [workouts, setWorkouts] = useState<MyWorkout[]>([]);
	const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>(
		[],
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [startOpen, setStartOpen] = useState(false);
	const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
	const [starting, setStarting] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);
	const [emptyWorkoutName, setEmptyWorkoutName] = useState('');
	const inProgressWorkout = workouts.find(
		(workout) => workout.status === 'in_progress',
	);
	const hasWorkoutInProgress = !!inProgressWorkout;
	const availableToStart = workouts.filter((workout) =>
		['pending', 'scheduled'].includes(workout.status),
	);

	const createWorkout = async (values: TrainingFormValues) => {
		setCreating(true);
		setCreateError(null);
		const response = await workoutsService.createMine(values);
		setCreating(false);
		if (!response.success || !response.data) {
			setCreateError(response.error || 'Não foi possível criar o treino.');
			return;
		}
		setCreateOpen(false);
		router.push(`/training/${response.data.id}`);
	};

	const startWorkout = async () => {
		if (!selectedWorkoutId) return;
		setStarting(true);
		setStartError(null);
		let workoutId = selectedWorkoutId;
		if (selectedWorkoutId === '__empty__') {
			const createResponse = await workoutsService.createMine({
				name: emptyWorkoutName.trim() || undefined,
				activities: [],
			});
			workoutId = createResponse.data?.id ?? '';
			if (!createResponse.success || !workoutId) {
				setStarting(false);
				setStartError(createResponse.error || 'Não foi possível criar o novo treino.');
				return;
			}
		}
		if (!workoutId) {
			setStarting(false);
			setStartError('Não foi possível criar o novo treino.');
			return;
		}
		const response = await workoutsService.start(workoutId);
		setStarting(false);
		if (!response.success || !response.data) {
			setStartError(response.error || 'Não foi possível iniciar o treino.');
			return;
		}
		setStartOpen(false);
		router.push(`/training/${response.data.id}`);
	};

	useEffect(() => {
		let isMounted = true;

		void Promise.all([
			workoutsService.findMine(),
			workoutsService.findMyCompleted(),
		]).then(([activeResponse, completedResponse]) => {
			if (!isMounted) return;
			if (activeResponse.error || completedResponse.error)
				setError(activeResponse.error || completedResponse.error || null);
			else {
				setWorkouts(activeResponse.data ?? []);
				setCompletedWorkouts(completedResponse.data ?? []);
			}
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
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="max-w-2xl">
					<p className="type-label-caps text-primary-fixed">Minha rotina</p>
					<h1
						id="my-workouts-title"
						className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-3xl lg:text-4xl"
					>
						Meus treinos
					</h1>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						className="w-full sm:w-auto"
						variant="outline"
						onClick={() => {
							setCreateError(null);
							setCreateOpen(true);
						}}
					>
						<RiAddLine /> Criar treino
					</Button>
					{hasWorkoutInProgress ? (
						<Button
							className="w-full sm:w-auto"
							onClick={() => router.push(`/training/${inProgressWorkout.id}`)}
						>
							<RiPlayLine /> Retomar treino
						</Button>
					) : (
						<Button
							className="w-full sm:w-auto"
							disabled={isLoading}
							onClick={() => {
								setStartError(null);
								setEmptyWorkoutName('');
								setSelectedWorkoutId(availableToStart[0]?.id ?? '__empty__');
								setStartOpen(true);
							}}
						>
							<RiPlayLine /> Iniciar treino
						</Button>
					)}
				</div>
			</div>

			{isLoading ? (
				<p className="type-body-md text-on-surface-variant">
					Carregando seus treinos...
				</p>
			) : error ? (
				<ErrorBox message={error} />
			) : (
				<>
					{workouts.length === 0 ? (
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
					{completedWorkouts.length > 0 && (
						<section
							className="space-y-3 pt-3"
							aria-labelledby="completed-workouts-title"
						>
							<div>
								<p className="type-label-caps text-on-surface-variant">
									Histórico recente
								</p>
								<h2 id="completed-workouts-title" className="mt-1 text-xl font-bold">
									Últimos treinos finalizados
								</h2>
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
								{completedWorkouts.map((workout) => (
									<Link
										key={workout.id}
										href={`/training/${workout.id}`}
										className="flex min-w-0 flex-col rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary-fixed hover:bg-surface-container sm:p-5"
										aria-label={`Abrir treino finalizado ${workout.templateName}`}
									>
										<div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
											<h3 className="type-headline-md break-words">
												{workout.templateName}
											</h3>
											<span className="type-label-caps shrink-0 rounded-full bg-surface-variant px-2 py-1 text-on-surface-variant">
												Finalizado
											</span>
										</div>
										{workout.templateDescription && (
											<p className="type-body-md mt-3 break-words text-on-surface-variant">
												{workout.templateDescription}
											</p>
										)}
										<p className="type-body-md mt-5 pt-1 text-on-surface-variant sm:mt-auto sm:pt-5">
											{workout.performedAt
												? `Finalizado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(workout.performedAt))}`
												: 'Finalizado'}
										</p>
									</Link>
								))}
							</div>
						</section>
					)}
				</>
			)}
			<Modal
				isOpen={createOpen}
				title="Criar treino do zero"
				description="Monte um treino avulso com os exercícios e séries que deseja realizar."
				onClose={() => !creating && setCreateOpen(false)}
			>
				{createError && <ErrorBox message={createError} />}
				<TrainingForm
					onSubmit={createWorkout}
					onCancel={() => setCreateOpen(false)}
					isSubmitting={creating}
					submitLabel="Criar treino"
				/>
			</Modal>
			<Modal
				isOpen={startOpen}
				title="Iniciar treino"
				description="Selecione um treino pendente ou agendado para começar agora."
				onClose={() => !starting && setStartOpen(false)}
			>
				<div className="space-y-5">
					{startError && <ErrorBox message={startError} />}
					<Select
						label="Treino"
						value={selectedWorkoutId}
						onChange={(event) => setSelectedWorkoutId(event.target.value)}
						placeholder="Selecione um treino"
						options={[
							...availableToStart.map((workout) => ({
								value: workout.id,
								label: `${workout.templateName} · ${formatScheduledDate(workout.scheduledDate)}`,
							})),
							{ value: '__empty__', label: 'Criar novo treino' },
						]}
					/>
					{selectedWorkoutId === '__empty__' && (
						<Input
							label="Nome do treino (opcional)"
							value={emptyWorkoutName}
							maxLength={100}
							onChange={(event) => setEmptyWorkoutName(event.target.value)}
							placeholder="Ex.: Treino livre"
							hint="Sem nome, será usado automaticamente o nome do aluno e a data atual."
						/>
					)}
					<div className="flex justify-end gap-3 border-t border-outline-variant pt-5">
						<Button variant="outline" onClick={() => setStartOpen(false)}>
							Cancelar
						</Button>
						<Button
							disabled={!selectedWorkoutId || starting}
							onClick={() => void startWorkout()}
						>
							<RiPlayLine /> {starting ? 'Iniciando...' : 'Iniciar treino'}
						</Button>
					</div>
				</div>
			</Modal>
		</section>
	);
}
