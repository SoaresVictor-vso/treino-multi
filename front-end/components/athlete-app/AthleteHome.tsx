'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiCloseLine, RiPlayFill, RiRunLine, RiTimeLine } from 'react-icons/ri';
import TrainingForm, { type TrainingFormValues } from '@/components/training/TrainingForm';
import Calendar, { localDateKey } from '@/components/ui/Calendar';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Modal from '@/components/ui/Modal';
import {
	workoutsService,
	type CalendarWorkout,
	type MyWorkout,
} from '@/gateway/services/workouts';

type DatedWorkout = CalendarWorkout & { date: string };
const activeStatuses = ['pending', 'scheduled'];

function firstName(name?: string) {
	return name?.trim().split(/\s+/)[0] || 'atleta';
}
function previousDate(date: string) {
	const previous = new Date(`${date}T12:00:00`);
	previous.setDate(previous.getDate() - 1);
	return localDateKey(previous);
}
function workoutCalendarDate(workout: CalendarWorkout) {
	if (workout.status === 'completed' || workout.status === 'cancelled')
		return workout.performedAt
			? localDateKey(workout.performedAt)
			: workout.scheduledDate
				? localDateKey(workout.scheduledDate)
				: null;
	if (workout.status === 'in_progress') return localDateKey(new Date());
	return workout.scheduledDate ? localDateKey(workout.scheduledDate) : null;
}
function formatScheduledDate(date: string | null) {
	if (!date) return 'disponível agora';
	const parsed = new Date(
		/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date,
	);
	if (Number.isNaN(parsed.getTime())) return 'disponível agora';
	return new Intl.DateTimeFormat('pt-BR', {
		day: '2-digit',
		month: 'long',
	}).format(parsed);
}

export default function AthleteHome({ athleteName }: { athleteName?: string }) {
	const router = useRouter();
	const [calendarMonth, setCalendarMonth] = useState(
		() => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	);
	const [calendarWorkouts, setCalendarWorkouts] = useState<CalendarWorkout[]>(
		[],
	);
	const [activeWorkouts, setActiveWorkouts] = useState<MyWorkout[]>([]);
	const [loading, setLoading] = useState(true);
	const [starting, setStarting] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [creationMode, setCreationMode] = useState<'future' | 'completed'>('future');
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const loadCalendar = useCallback(async (month: Date) => {
		setLoading(true);
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		const [calendar, active] = await Promise.all([
			workoutsService.findMyCalendar(localDateKey(month), timeZone),
			workoutsService.findMine(),
		]);
		if (!calendar.success || !active.success)
			setError(
				calendar.error || active.error || 'Não foi possível carregar seus treinos.',
			);
		else {
			setError(null);
			setCalendarWorkouts(calendar.data?.workouts ?? []);
			setActiveWorkouts(active.data ?? []);
		}
		setLoading(false);
	}, []);
	useEffect(() => {
		const timer = setTimeout(() => {
			void loadCalendar(calendarMonth);
		});
		return () => clearTimeout(timer);
	}, [calendarMonth, loadCalendar]);
	const entries = useMemo<DatedWorkout[]>(
		() =>
			calendarWorkouts.flatMap((workout) => {
				const date = workoutCalendarDate(workout);
				return date ? [{ ...workout, date }] : [];
			}),
		[calendarWorkouts],
	);
	const undated = useMemo(
		() =>
			activeWorkouts
				.filter(
				(workout) =>
					!workout.scheduledDate && activeStatuses.includes(workout.status),
				)
				.map((workout) => ({ ...workout, performedAt: null })),
		[activeWorkouts],
	);
	const nextWorkout = useMemo(
		() =>
			activeWorkouts
				.filter((workout) => activeStatuses.includes(workout.status))
				.sort((a, b) =>
					(a.scheduledDate ?? '9999-12-31').localeCompare(
						b.scheduledDate ?? '9999-12-31',
					),
				)[0],
		[activeWorkouts],
	);
	const inProgress = activeWorkouts.find((workout) => workout.status === 'in_progress');
	const today = localDateKey(new Date());
	const createWorkout = async (values: TrainingFormValues) => {
		setCreating(true);
		const result = await workoutsService.createMine({
			...values,
			recordAsCompleted: creationMode === 'completed',
		});
		setCreating(false);
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível criar o treino.');
			return;
		}
		setCreateOpen(false);
		setError(null);
		await loadCalendar(calendarMonth);
	};
	const startWorkout = async (workout: MyWorkout) => {
		if (workout.status === 'in_progress') { router.push(`/training/${workout.id}`); return; }
		setStarting(true);
		const result = await workoutsService.start(workout.id);
		setStarting(false);
		if (!result.success || !result.data) { setError(result.error || 'Não foi possível iniciar o treino.'); return; }
		router.push(`/training/${workout.id}`);
	};
	return (
		<section className="mx-auto w-full max-w-4xl pb-4">
			<header className="flex items-start justify-between gap-4">
				<div>
				<h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
					Olá, {firstName(athleteName)}.
				</h1>
				<p className="mt-1 text-sm leading-6 text-on-surface-variant sm:text-base">
					{inProgress ? 'Seu treino está esperando por você.' : nextWorkout
						? `Seu próximo treino é ${formatScheduledDate(nextWorkout.scheduledDate)}.`
						: 'Tudo em dia por aqui.'}
				</p>
				</div>
				<div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary-container/25 bg-primary-container/10 text-primary-fixed sm:grid"><RiRunLine size={24} aria-hidden /></div>
			</header>
			{loading ? <Skeleton /> : inProgress ? <FeaturedWorkout workout={inProgress} label="Em andamento" action="Retomar treino" icon={<RiPlayFill size={18} />} starting={starting} onAction={() => void startWorkout(inProgress)} /> : nextWorkout ? <FeaturedWorkout workout={nextWorkout} label="Próximo treino" action="Iniciar treino" icon={<RiPlayFill size={18} />} starting={starting} onAction={() => void startWorkout(nextWorkout)} /> : <AllCaughtUp onCreate={() => { setCreationMode('future'); setCreateOpen(true); }} />}
			{!loading && (inProgress || nextWorkout) && <button type="button" onClick={() => { setCreationMode('future'); setCreateOpen(true); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary-container/40 px-4 text-sm font-bold text-primary-fixed hover:bg-primary-container hover:text-on-primary-fixed"><RiAddLine size={19} /> Criar treino</button>}
			<div className="mt-7">
				{error ? (
					<ErrorBox message={error} />
				) : (
					<WorkoutCalendar
						month={calendarMonth}
						workouts={entries}
						undated={undated}
						onMonthChange={setCalendarMonth}
						onChanged={() => void loadCalendar(calendarMonth)}
					/>
				)}
			</div>
			<Modal isOpen={createOpen} title="Criar treino" description="Escolha se o treino será realizado no futuro ou se deseja registrar um treino já realizado." onClose={() => !creating && setCreateOpen(false)} closeOnBackdrop={false} closeOnEscape={false}>
				<div className="space-y-5">
					<fieldset className="space-y-2">
						<legend className="text-sm font-semibold">O que deseja fazer?</legend>
						<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant p-3">
							<input type="radio" name="creationMode" checked={creationMode === 'future'} onChange={() => setCreationMode('future')} />
							<span><strong className="block text-sm">Criar</strong><span className="text-xs text-on-surface-variant">Treino pendente ou agendado para hoje ou uma data futura.</span></span>
						</label>
						<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant p-3">
							<input type="radio" name="creationMode" checked={creationMode === 'completed'} onChange={() => setCreationMode('completed')} />
							<span><strong className="block text-sm">Registrar realizado</strong><span className="text-xs text-on-surface-variant">Escolha uma data passada. O início e o fim serão registrados nessa data.</span></span>
						</label>
					</fieldset>
					<TrainingForm key={creationMode} onSubmit={createWorkout} onCancel={() => setCreateOpen(false)} isSubmitting={creating} submitLabel={creationMode === 'completed' ? 'Registrar realizado' : 'Criar treino'} noteLabel="Minha nota (opcional)" recordAsCompleted={creationMode === 'completed'} dateMin={creationMode === 'future' ? today : undefined} dateMax={creationMode === 'completed' ? previousDate(today) : undefined} dateRequired={creationMode === 'completed'} dateLabel={creationMode === 'completed' ? 'Data em que foi realizado' : undefined} dateHint={creationMode === 'completed' ? 'O treino será registrado como realizado nessa data.' : undefined} />
				</div>
			</Modal>
		</section>
	);
}

function WorkoutCalendar({
	month,
	workouts,
	undated,
	onMonthChange,
	onChanged,
}: {
	month: Date;
	workouts: DatedWorkout[];
	undated: CalendarWorkout[];
	onMonthChange: (month: Date) => void;
	onChanged: () => void;
}) {
	const [selectedDay, setSelectedDay] = useState<{
		date: string;
		workouts: DatedWorkout[];
	} | null>(null);
	const [rescheduleTarget, setRescheduleTarget] =
		useState<CalendarWorkout | null>(null);
	const [cancelTarget, setCancelTarget] = useState<CalendarWorkout | null>(null);
	const [scheduledDate, setScheduledDate] = useState('');
	const [saving, setSaving] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const openCancel = (workout: CalendarWorkout) => {
		setActionError(null);
		setCancelTarget(workout);
	};
	const cancel = async () => {
		if (!cancelTarget) return;
		setSaving(true);
		setActionError(null);
		const result = await workoutsService.cancel(cancelTarget.id);
		setSaving(false);
		if (!result.success)
			setActionError(result.error || 'Não foi possível cancelar o treino.');
		else {
			setCancelTarget(null);
			setSelectedDay(null);
			onChanged();
		}
	};
	const openReschedule = (workout: CalendarWorkout) => {
		setActionError(null);
		setScheduledDate(workout.scheduledDate ?? '');
		setRescheduleTarget(workout);
	};
	const reschedule = async () => {
		if (!rescheduleTarget || !scheduledDate) return;
		setSaving(true);
		setActionError(null);
		const result = await workoutsService.reschedule(
			rescheduleTarget.id,
			scheduledDate,
		);
		setSaving(false);
		if (!result.success)
			setActionError(result.error || 'Não foi possível reagendar o treino.');
		else {
			setRescheduleTarget(null);
			setSelectedDay(null);
			onChanged();
		}
	};
	return (
		<div className="space-y-5">
			<div
				className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs font-semibold text-on-surface-variant"
				aria-label="Legenda do calendário"
			>
				<span className="inline-flex items-center gap-1.5">
					<i className="h-2.5 w-2.5 rounded-sm bg-primary-container" />
					Realizado
				</span>
				<span className="inline-flex items-center gap-1.5">
					<i className="h-2.5 w-2.5 rounded-sm bg-error-container" />
					Cancelado
				</span>
				<span className="inline-flex items-center gap-1.5">
					<i className="h-2.5 w-2.5 rounded-sm border border-primary-fixed" />
					Agendado
				</span>
			</div>
			<Calendar
				month={month}
				entries={workouts}
				onMonthChange={onMonthChange}
				ariaLabel="Calendário de treinos"
				onDayClick={(dayWorkouts, date) =>
					setSelectedDay({ date, workouts: dayWorkouts })
				}
				renderDaySummary={(dayWorkouts) => (
					<CalendarDaySummary workouts={dayWorkouts} />
				)}
				renderEntry={(workout) => <WorkoutItem workout={workout} />}
			/>
			{undated.length > 0 && (
				<section aria-labelledby="undated-workouts-title">
					<div className="mb-3 flex items-center gap-2">
						<RiTimeLine className="text-primary-fixed" />
						<div>
							<h2 id="undated-workouts-title" className="font-extrabold">
								Treinos sem data
							</h2>
							<p className="text-sm text-on-surface-variant">
								Escolha quando realizá-los ou cancele-os.
							</p>
						</div>
					</div>
					<div className="space-y-3">
						{undated.map((workout) => (
							<WorkoutItem
								key={workout.id}
								workout={workout}
								expanded
								onCancel={openCancel}
								onReschedule={openReschedule}
								disabled={saving}
							/>
						))}
					</div>
				</section>
			)}
			<Modal
				isOpen={Boolean(selectedDay)}
				title={
					selectedDay
						? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
								new Date(`${selectedDay.date}T12:00:00`),
							)
						: 'Treinos'
				}
				description={
					selectedDay
						? `${selectedDay.workouts.length} treino${selectedDay.workouts.length === 1 ? '' : 's'} neste dia.`
						: undefined
				}
				onClose={() => !saving && setSelectedDay(null)}
			>
				<div className="space-y-3">
					{actionError && <ErrorBox message={actionError} />}
					{selectedDay?.workouts.map((workout) => (
						<WorkoutItem
							key={workout.id}
							workout={workout}
							expanded
							onCancel={openCancel}
							onReschedule={openReschedule}
							disabled={saving}
						/>
					))}
				</div>
			</Modal>
			<Modal
				isOpen={Boolean(cancelTarget)}
				title="Cancelar treino"
				description={`Tem certeza que deseja cancelar ${cancelTarget?.templateName ?? 'este treino'}?`}
				onClose={() => !saving && setCancelTarget(null)}
			>
				<div className="space-y-4">
					{actionError && <ErrorBox message={actionError} />}
					<p className="text-sm text-on-surface-variant">
						Esta ação não pode ser desfeita.
					</p>
					<div className="flex justify-end gap-3">
						<Button variant="outline" disabled={saving} onClick={() => setCancelTarget(null)}>
							Voltar
						</Button>
						<Button variant="danger" disabled={saving} onClick={() => void cancel()}>
							{saving ? 'Cancelando...' : 'Cancelar treino'}
						</Button>
					</div>
				</div>
			</Modal>
			<Modal
				isOpen={Boolean(rescheduleTarget)}
				title="Reagendar treino"
				description={rescheduleTarget?.templateName}
				onClose={() => !saving && setRescheduleTarget(null)}
			>
				<div className="space-y-4">
					{actionError && <ErrorBox message={actionError} />}
					<label className="block text-sm font-bold">
						Nova data
						<input
							type="date"
							value={scheduledDate}
							min={localDateKey(new Date())}
							onChange={(event) => setScheduledDate(event.target.value)}
							className="mt-1 block min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3"
						/>
					</label>
					<div className="flex justify-end gap-3">
						<button
							type="button"
							onClick={() => setRescheduleTarget(null)}
							className="min-h-11 rounded-xl px-4 font-bold"
						>
							Voltar
						</button>
						<button
							type="button"
							disabled={!scheduledDate || saving}
							onClick={() => void reschedule()}
							className="min-h-11 rounded-xl bg-primary-container px-4 font-bold text-on-primary-fixed disabled:opacity-60"
						>
							{saving ? 'Salvando...' : 'Reagendar'}
						</button>
					</div>
				</div>
			</Modal>
		</div>
	);
}

function CalendarDaySummary({ workouts }: { workouts: CalendarWorkout[] }) {
	const colors = {
		completed: 'bg-primary-container',
		cancelled: 'bg-error-container',
		skipped: 'bg-error-container',
		scheduled: 'border border-primary-fixed',
		in_progress: 'bg-primary-fixed-dim',
		pending: 'bg-outline-variant',
	};
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2">
			<div className="flex flex-wrap justify-center gap-1">
				{workouts.slice(0, 6).map((workout) => (
					<i
						key={workout.id}
						className={`h-2 w-2 rounded-full ${colors[workout.status]}`}
					/>
				))}
			</div>
			<span className="text-sm font-extrabold leading-none text-primary-fixed sm:text-base">
				{workouts.length}
			</span>
		</div>
	);
}

function WorkoutItem({
	workout,
	expanded = false,
	onCancel,
	onReschedule,
	disabled = false,
}: {
	workout: CalendarWorkout;
	expanded?: boolean;
	onCancel?: (workout: CalendarWorkout) => void;
	onReschedule?: (workout: CalendarWorkout) => void;
	disabled?: boolean;
}) {
	const presentation = {
		completed: {
			label: 'Realizado',
			className: 'border-primary-fixed bg-primary-container/20 text-primary-fixed',
		},
		cancelled: {
			label: 'Cancelado',
			className: 'border-error bg-error-container/20 text-error',
		},
		skipped: {
			label: 'Cancelado',
			className: 'border-error bg-error-container/20 text-error',
		},
		scheduled: {
			label: 'Agendado',
			className: 'border-primary-fixed bg-transparent text-primary-fixed',
		},
		in_progress: {
			label: 'Em andamento',
			className:
				'border-primary-fixed-dim bg-primary-container/10 text-primary-fixed-dim',
		},
		pending: {
			label: 'Pendente',
			className:
				'border-on-surface-variant bg-surface-container-high text-on-surface-variant',
		},
	}[workout.status];
	const actionable =
		activeStatuses.includes(workout.status) && onCancel && onReschedule;
	return (
		<article
			className={`rounded-xl border px-4 py-3 text-sm font-bold ${presentation.className}`}
		>
			<Link
				href={`/training/${workout.id}`}
				title={`${workout.templateName} — ${presentation.label}`}
				className="block hover:brightness-110"
			>
				<span className="block">{workout.templateName}</span>
				<span className="mt-1 block text-xs opacity-80">
					{presentation.label}
					{expanded && workout.templateDescription
						? ` · ${workout.templateDescription}`
						: ''}
				</span>
			</Link>
			{actionable && (
				<div className="mt-3 flex gap-2 border-t border-current/15 pt-3">
					<button
						type="button"
						disabled={disabled}
						onClick={() => onReschedule(workout)}
						className="min-h-9 rounded-lg border border-current/40 px-3 text-xs font-extrabold disabled:opacity-60"
					>
						Reagendar
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => onCancel(workout)}
						className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-xs font-extrabold text-error disabled:opacity-60"
					>
						<RiCloseLine />
						Cancelar
					</button>
				</div>
			)}
		</article>
	);
}
function FeaturedWorkout({ workout, label, action, icon, starting, onAction }: { workout: MyWorkout; label: string; action: string; icon: React.ReactNode; starting: boolean; onAction: () => void }) {
	return <article className="mt-7 overflow-hidden rounded-[1.75rem] border border-primary-container/30 bg-surface-container-low shadow-[0_18px_60px_rgba(171,214,0,0.1)]"><div className="border-b border-primary-container/15 bg-primary-container/8 px-5 py-3 sm:px-7"><p className="type-label-caps text-primary-fixed">{label}</p></div><div className="p-5 sm:p-7"><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{workout.templateName}</h2><p className="mt-2 text-sm text-on-surface-variant">{workout.templateDescription || (workout.status === 'in_progress' ? 'Sua sessão está em andamento.' : formatScheduledDate(workout.scheduledDate))}</p><button type="button" disabled={starting} onClick={onAction} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-container px-5 text-sm font-extrabold text-on-primary-fixed transition hover:bg-primary-fixed disabled:cursor-wait disabled:opacity-65">{icon}{starting ? 'Iniciando...' : action}</button></div></article>;
}

function AllCaughtUp({ onCreate }: { onCreate: () => void }) {
	return <article className="mt-7 rounded-[1.75rem] border border-white/8 bg-surface-container-low p-5 sm:p-7"><p className="type-label-caps text-primary-fixed">Tudo em dia</p><h2 className="mt-3 text-2xl font-extrabold tracking-tight">Nenhum treino na agenda</h2><p className="mt-2 text-sm text-on-surface-variant">Você não possui treinos programados no momento.</p><button type="button" onClick={onCreate} className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-primary-container/40 px-4 text-sm font-bold text-primary-fixed transition hover:bg-primary-container hover:text-on-primary-fixed"><RiAddLine size={19} />Criar treino</button></article>;
}

function Skeleton() {
	return (
		<div className="h-80 animate-pulse rounded-[1.5rem] border border-white/8 bg-surface-container-low" />
	);
}
