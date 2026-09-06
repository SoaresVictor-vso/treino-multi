'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	RiAddLine,
	RiArrowRightUpLine,
	RiCalendarLine,
	RiCheckLine,
	RiPlayFill,
	RiRunLine,
} from 'react-icons/ri';
import ErrorBox from '@/components/ui/ErrorBox';
import {
	workoutsService,
	type CompletedWorkout,
	type MyWorkout,
	type WorkoutDetail,
} from '@/gateway/services/workouts';

type Tab = 'agenda' | 'history';

function firstName(name?: string) {
	return name?.trim().split(/\s+/)[0] || 'atleta';
}
function formatDate(date: string | null) {
	if (!date) return 'Disponível agora';
	return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
		.format(new Date(`${date}T12:00:00`))
		.replace('.', '');
}
function relativeDate(date: string | null) {
	if (!date) return 'Disponível agora';
	const target = new Date(`${date}T12:00:00`);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
	return diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : formatDate(date);
}
function formatCompletedDate(date: string | null) {
	if (!date) return 'Treino concluído';
	return `Concluído em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(new Date(date))}`;
}
function sortUpcoming(workouts: MyWorkout[]) {
	return [...workouts].sort((a, b) =>
		!a.scheduledDate
			? 1
			: !b.scheduledDate
				? -1
				: a.scheduledDate.localeCompare(b.scheduledDate),
	);
}

export default function AthleteHome({ athleteName }: { athleteName?: string }) {
	const router = useRouter();
	const [tab, setTab] = useState<Tab>('agenda');
	const [workouts, setWorkouts] = useState<MyWorkout[]>([]);
	const [completed, setCompleted] = useState<CompletedWorkout[]>([]);
	const [focusDetail, setFocusDetail] = useState<WorkoutDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void Promise.all([
			workoutsService.findMine(),
			workoutsService.findMyCompleted(),
		]).then(([activeResult, completedResult]) => {
			if (!active) return;
			if (!activeResult.success || !completedResult.success) {
				setError(
					activeResult.error ||
						completedResult.error ||
						'Não foi possível carregar seus treinos.',
				);
				setLoading(false);
				return;
			}
			const activeWorkouts = activeResult.data ?? [];
			setWorkouts(activeWorkouts);
			setCompleted(completedResult.data ?? []);
			setLoading(false);
			const priority =
				activeWorkouts.find((workout) => workout.status === 'in_progress') ??
				sortUpcoming(activeWorkouts)[0];
			if (priority)
				void workoutsService.findOne(priority.id).then((result) => {
					if (active && result.success && result.data) setFocusDetail(result.data);
				});
		});
		return () => {
			active = false;
		};
	}, []);

	const inProgress = workouts.find(
		(workout) => workout.status === 'in_progress',
	);
	const agenda = useMemo(
		() =>
			sortUpcoming(workouts.filter((workout) => workout.status !== 'in_progress')),
		[workouts],
	);
	const nextWorkout = agenda[0];
	const featuredWorkout = inProgress ?? nextWorkout;
	const exerciseCount =
		focusDetail && focusDetail.id === featuredWorkout?.id
			? focusDetail.executions.length
			: 0;
	const completedExerciseCount =
		focusDetail && focusDetail.id === inProgress?.id
			? focusDetail.executions.filter((exercise) =>
					['completed', 'skipped'].includes(exercise.status),
				).length
			: 0;
	const exerciseNames =
		focusDetail && focusDetail.id === nextWorkout?.id
			? focusDetail.executions
					.slice(0, 3)
					.map((execution) => execution.exercise.name)
			: [];

	const startWorkout = async (workout: MyWorkout) => {
		if (workout.status === 'in_progress') {
			router.push(`/training/${workout.id}`);
			return;
		}
		setStarting(true);
		setError(null);
		const result = await workoutsService.start(workout.id);
		setStarting(false);
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível iniciar o treino.');
			return;
		}
		window.dispatchEvent(new Event('workout-status-changed'));
		router.push(`/training/${workout.id}`);
	};
	const createFreeWorkout = async () => {
		setStarting(true);
		setError(null);
		const result = await workoutsService.createMine({
			activities: [],
			startImmediately: true,
		});
		setStarting(false);
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível iniciar o treino livre.');
			return;
		}
		window.dispatchEvent(new Event('workout-status-changed'));
		router.push(`/training/${result.data.id}`);
	};
	const context = inProgress
		? 'Seu treino está esperando por você.'
		: nextWorkout
			? `Seu próximo treino é ${relativeDate(nextWorkout.scheduledDate).toLowerCase()}.`
			: 'Tudo em dia por aqui.';

	return (
		<section className="mx-auto w-full max-w-4xl pb-4">
			<header className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
						Olá, {firstName(athleteName)}.
					</h1>
					<p className="mt-1 text-sm leading-6 text-on-surface-variant sm:text-base">
						{context}
					</p>
				</div>
				<div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary-container/25 bg-primary-container/10 text-primary-fixed sm:grid">
					<RiRunLine size={24} aria-hidden />
				</div>
			</header>
			{loading ? (
				<FeaturedSkeleton />
			) : inProgress ? (
				<InProgressCard
					workout={inProgress}
					total={exerciseCount}
					completed={completedExerciseCount}
					onContinue={() => void startWorkout(inProgress)}
				/>
			) : nextWorkout ? (
				<NextWorkoutCard
					workout={nextWorkout}
					exerciseCount={exerciseCount}
					exerciseNames={exerciseNames}
					starting={starting}
					onStart={() => void startWorkout(nextWorkout)}
				/>
			) : (
				<AllCaughtUpCard
					starting={starting}
					onCreate={() => void createFreeWorkout()}
				/>
			)}
			<div
				className="mt-7 flex rounded-2xl border border-white/8 bg-surface-container-low p-1.5"
				role="tablist"
				aria-label="Treinos"
			>
				{(
					[
						['agenda', 'Agenda', agenda.length],
						['history', 'Histórico', completed.length],
					] as const
				).map(([value, label, count]) => (
					<button
						key={value}
						type="button"
						role="tab"
						aria-selected={tab === value}
						onClick={() => setTab(value)}
						className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${tab === value ? 'bg-surface-container-high text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
					>
						{label}{' '}
						<span
							className={`rounded-full px-2 py-0.5 text-xs ${tab === value ? 'bg-white/8 text-on-surface-variant' : 'bg-surface-variant text-on-surface-variant'}`}
						>
							{count}
						</span>
					</button>
				))}
			</div>
			<div className="mt-5" role="tabpanel">
				{loading ? (
					<ListSkeleton />
				) : error ? (
					<ErrorBox message={error} />
				) : tab === 'agenda' ? (
					<UpcomingList
						workouts={agenda}
						onCreate={() => void createFreeWorkout()}
						starting={starting}
					/>
				) : (
					<CompletedList workouts={completed} />
				)}
			</div>
		</section>
	);
}

function FeaturedSkeleton() {
	return (
		<div className="mt-7 h-72 animate-pulse rounded-[1.75rem] border border-white/8 bg-surface-container-low" />
	);
}
function ListSkeleton() {
	return (
		<div className="h-40 animate-pulse rounded-[1.5rem] border border-white/8 bg-surface-container-low" />
	);
}
function InProgressCard({
	workout,
	total,
	completed,
	onContinue,
}: {
	workout: MyWorkout;
	total: number;
	completed: number;
	onContinue: () => void;
}) {
	const progress = total ? Math.round((completed / total) * 100) : 0;
	return (
		<article className="mt-7 overflow-hidden rounded-[1.75rem] border border-primary-container/30 bg-surface-container-low shadow-[0_18px_60px_rgba(171,214,0,0.1)]">
			<div className="border-b border-primary-container/15 bg-primary-container/8 px-5 py-3 sm:px-7">
				<p className="type-label-caps text-primary-fixed">Em andamento</p>
			</div>
			<div className="p-5 sm:p-7">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
							{workout.templateName}
						</h2>
						<p className="mt-2 text-sm text-on-surface-variant">
							{total
								? `${completed} de ${total} exercícios concluídos`
								: 'Sua sessão está em andamento'}
						</p>
					</div>
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-container text-on-primary-fixed">
						<RiPlayFill size={20} />
					</span>
				</div>
				<div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-container-high">
					<div
						className="h-full rounded-full bg-primary-container transition-all"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<button
					type="button"
					onClick={onContinue}
					className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-container px-5 text-sm font-extrabold text-on-primary-fixed transition hover:bg-primary-fixed focus:outline-none focus:ring-2 focus:ring-primary-fixed focus:ring-offset-2 focus:ring-offset-surface-container-low"
				>
					<RiPlayFill size={18} />
					Retomar treino
				</button>
			</div>
		</article>
	);
}
function NextWorkoutCard({
	workout,
	exerciseCount,
	exerciseNames,
	starting,
	onStart,
}: {
	workout: MyWorkout;
	exerciseCount: number;
	exerciseNames: string[];
	starting: boolean;
	onStart: () => void;
}) {
	return (
		<article className="mt-7 overflow-hidden rounded-[1.75rem] border border-primary-container/30 bg-surface-container-low shadow-[0_18px_60px_rgba(171,214,0,0.1)]">
			<div className="border-b border-primary-container/15 bg-primary-container/8 px-5 py-3 sm:px-7">
				<p className="type-label-caps text-primary-fixed">Próximo treino</p>
			</div>
			<div className="p-5 sm:p-7">
				<h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
					{workout.templateName}
				</h2>
				<p className="mt-2 text-sm font-semibold text-primary-fixed">
					{relativeDate(workout.scheduledDate)}{' '}
					<span className="px-1 text-on-surface-variant">•</span>{' '}
					{exerciseCount ? `${exerciseCount} exercícios` : 'Treino prescrito'}
				</p>
				{exerciseNames.length > 0 && (
					<p className="mt-5 text-sm leading-6 text-on-surface-variant">
						{exerciseNames.join(' · ')}
						{exerciseCount > exerciseNames.length
							? ` · +${exerciseCount - exerciseNames.length} exercícios`
							: ''}
					</p>
				)}
				<button
					type="button"
					disabled={starting}
					onClick={onStart}
					className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-container px-5 text-sm font-extrabold text-on-primary-fixed transition hover:bg-primary-fixed focus:outline-none focus:ring-2 focus:ring-primary-fixed focus:ring-offset-2 focus:ring-offset-surface-container-low disabled:cursor-wait disabled:opacity-65"
				>
					<RiPlayFill size={18} />
					{starting ? 'Iniciando...' : 'Iniciar treino'}
				</button>
			</div>
		</article>
	);
}
function AllCaughtUpCard({
	starting,
	onCreate,
}: {
	starting: boolean;
	onCreate: () => void;
}) {
	return (
		<article className="mt-7 rounded-[1.75rem] border border-white/8 bg-surface-container-low p-5 sm:p-7">
			<p className="type-label-caps text-primary-fixed">Tudo em dia</p>
			<h2 className="mt-3 text-2xl font-extrabold tracking-tight">
				Nenhum treino na agenda
			</h2>
			<p className="mt-2 text-sm text-on-surface-variant">
				Você não possui treinos programados no momento.
			</p>
			<button
				type="button"
				disabled={starting}
				onClick={onCreate}
				className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-primary-container/40 px-4 text-sm font-bold text-primary-fixed transition hover:bg-primary-container hover:text-on-primary-fixed disabled:cursor-wait disabled:opacity-65"
			>
				<RiAddLine size={19} />
				Criar treino livre
			</button>
		</article>
	);
}
function UpcomingList({
	workouts,
	onCreate,
	starting,
}: {
	workouts: MyWorkout[];
	onCreate: () => void;
	starting: boolean;
}) {
	if (!workouts.length)
		return (
			<div className="grid min-h-56 place-items-center rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-low px-6 text-center">
				<div>
					<div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-container-high text-primary-fixed">
						<RiCalendarLine size={24} />
					</div>
					<h2 className="mt-4 text-lg font-extrabold">Nenhum treino na agenda</h2>
					<p className="mt-2 text-sm text-on-surface-variant">
						Você não possui treinos programados.
					</p>
					<button
						type="button"
						disabled={starting}
						onClick={onCreate}
						className="mt-5 text-sm font-bold text-primary-fixed hover:text-primary-container disabled:opacity-60"
					>
						Criar treino livre
					</button>
				</div>
			</div>
		);
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{workouts.map((workout) => (
				<WorkoutCard key={workout.id} workout={workout} />
			))}
		</div>
	);
}
function CompletedList({ workouts }: { workouts: CompletedWorkout[] }) {
	if (!workouts.length)
		return (
			<div className="grid min-h-56 place-items-center rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-low px-6 text-center">
				<div>
					<div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-container-high text-on-surface-variant">
						<RiCheckLine size={25} />
					</div>
					<h2 className="mt-4 text-lg font-extrabold">
						Seu histórico começa no próximo treino
					</h2>
					<p className="mt-2 text-sm text-on-surface-variant">
						Quando concluir uma sessão, ela aparecerá aqui.
					</p>
				</div>
			</div>
		);
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{workouts.map((workout) => (
				<WorkoutCard key={workout.id} workout={workout} completed />
			))}
		</div>
	);
}
function WorkoutCard({
	workout,
	completed = false,
}: {
	workout: MyWorkout | CompletedWorkout;
	completed?: boolean;
}) {
	const detail = completed
		? formatCompletedDate((workout as CompletedWorkout).performedAt)
		: relativeDate(workout.scheduledDate);
	return (
		<Link
			href={`/training/${workout.id}`}
			className="group rounded-[1.5rem] border border-white/8 bg-surface-container-low p-5 transition hover:-translate-y-0.5 hover:border-primary-fixed/50 hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary-fixed"
		>
			<div className="flex items-start justify-between gap-3">
				<span
					className={`grid h-10 w-10 place-items-center rounded-xl ${completed ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary-container/12 text-primary-fixed'}`}
				>
					{completed ? <RiCheckLine size={21} /> : <RiRunLine size={21} />}
				</span>
				<RiArrowRightUpLine
					className="text-on-surface-variant transition group-hover:text-primary-fixed"
					size={19}
				/>
			</div>
			<h2 className="mt-5 text-base font-extrabold">{workout.templateName}</h2>
			{workout.templateDescription && (
				<p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
					{workout.templateDescription}
				</p>
			)}
			<p
				className={`mt-5 text-xs font-bold ${completed ? 'text-on-surface-variant' : 'text-primary-fixed'}`}
			>
				{detail}
			</p>
		</Link>
	);
}
