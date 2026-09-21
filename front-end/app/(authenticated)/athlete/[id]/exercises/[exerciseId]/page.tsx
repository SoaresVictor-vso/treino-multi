'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiArrowDownSLine, RiArrowLeftLine } from 'react-icons/ri';
import ErrorBox from '@/components/ui/ErrorBox';
import ExerciseHistorySeriesList from '@/components/shared/ExerciseHistorySeriesList';
import {
	exerciseReviewsService,
	type ExerciseReviewSummary,
	type ExerciseReviewWorkout,
} from '@/gateway/services/exercise-reviews';

const numberFormat = new Intl.NumberFormat('pt-BR', {
	maximumFractionDigits: 2,
});
const format = (value: number | null, suffix = '') =>
	value === null ? '—' : `${numberFormat.format(value)}${suffix}`;
const date = (value: string) =>
	new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
		new Date(value),
	);
const shortDate = (value: string) =>
	new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
		new Date(value),
	);

export default function ExerciseReviewPage({
	params,
}: {
	params: Promise<{ id: string; exerciseId: string }>;
}) {
	const { id: athleteId, exerciseId: rawExerciseId } = use(params);
	const exerciseId = Number(rawExerciseId);
	const router = useRouter();
	const [summary, setSummary] = useState<ExerciseReviewSummary | null>(null);
	const [workouts, setWorkouts] = useState<ExerciseReviewWorkout[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void Promise.all([
			exerciseReviewsService.summary(athleteId, exerciseId),
			exerciseReviewsService.workouts(athleteId, exerciseId),
		]).then(([review, history]) => {
			if (!review.success || !review.data)
				setError(review.error || 'Não foi possível carregar a revisão.');
			else {
				setSummary(review.data);
				setWorkouts(history.data?.items ?? []);
				setError(null);
			}
		});
	}, [athleteId, exerciseId]);

	const metrics = summary?.exercise.metrics.map((metric) => metric.name) ?? [];
	const isWeightReps =
		metrics.includes('peso') && metrics.includes('repeticoes');
	const primaryField = isWeightReps
		? 'predictedRm'
		: metrics.includes('distancia')
			? 'distance'
			: metrics.includes('tempo')
				? 'duration'
				: 'repetitions';
	const secondaryField = isWeightReps
		? 'tonnage'
		: metrics.includes('distancia')
			? 'pace'
			: 'weight';
	const labels = summary?.exercise.metrics ?? [];

	return (
		<main className="mx-auto max-w-5xl p-4 sm:p-8">
			<button
				type="button"
				onClick={() => router.back()}
				className="mb-5 inline-flex items-center gap-2 text-primary"
			>
				<RiArrowLeftLine /> Voltar
			</button>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="text-sm text-on-surface-variant">Revisão exercício–atleta</p>
					<h1 className="text-2xl font-bold">
						{summary?.exercise.name ?? 'Carregando...'}
					</h1>
				</div>
				<p className="text-sm text-on-surface-variant">Período: últimos 3 meses</p>
			</div>
			{error && <ErrorBox message={error} />}
			{summary && (
				<>
					<section className="grid gap-3 sm:grid-cols-3">
						<Card
							label="RP registrado"
							value={format(summary.currentRp?.value ?? null)}
						/>
						<Card
							label="Melhor série"
							value={format(summary.bestSet?.predictedRm ?? null, ' 1RM')}
							detail={summary.bestSet ? date(summary.bestSet.date) : undefined}
						/>
						<Card label="1RM estimado" value={format(summary.estimatedRm, ' kg')} />
					</section>
					<section className="mt-6 grid gap-4 md:grid-cols-2">
						<Chart
							title={
								isWeightReps
									? 'Evolução do 1RM estimado'
									: metrics.includes('distancia')
										? 'Evolução da distância'
										: metrics.includes('tempo')
											? 'Evolução da duração'
											: 'Evolução das repetições'
							}
							metric={
								isWeightReps
									? '1RM'
									: metrics.includes('distancia')
										? 'Distância'
										: metrics.includes('tempo')
											? 'Duração'
											: 'Repetições'
							}
							unit={isWeightReps ? 'kg' : undefined}
							points={summary.charts}
							field={primaryField}
						/>
						<Chart
							title={
								isWeightReps
									? 'Tonelagem diária'
									: metrics.includes('distancia')
										? 'Pace'
										: 'Histórico'
							}
							metric={
								isWeightReps
									? 'Tonelagem'
									: metrics.includes('distancia')
										? 'Pace'
										: 'Peso'
							}
							unit={isWeightReps ? 'kg' : undefined}
							points={summary.charts}
							field={secondaryField}
						/>
					</section>
					<section className="mt-8">
						<h2 className="text-xl font-bold">Treinos realizados</h2>
						{workouts.length ? (
							<div className="mt-3 space-y-2">
								{workouts.map((workout) => (
									<WorkoutAccordion key={workout.id} workout={workout} labels={labels} />
								))}
							</div>
						) : (
							<p className="mt-3 text-on-surface-variant">
								Nenhum treino realizado nos últimos 3 meses.
							</p>
						)}
					</section>
				</>
			)}
		</main>
	);
}

function Card({
	label,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail?: string;
}) {
	return (
		<div className="rounded-xl bg-surface-container p-4">
			<p className="text-sm text-on-surface-variant">{label}</p>
			<strong className="text-xl">{value}</strong>
			{detail && <p className="text-sm">{detail}</p>}
		</div>
	);
}

function Chart({
	title,
	metric,
	unit,
	points,
	field,
}: {
	title: string;
	metric: string;
	unit?: string;
	points: ExerciseReviewSummary['charts'];
	field: keyof ExerciseReviewSummary['charts'][number];
}) {
	const values = points.filter((point) => typeof point[field] === 'number');
	const [selected, setSelected] = useState<number | null>(null);
	if (values.length < 2)
		return (
			<div className="rounded-xl border border-outline-variant p-4">
				<h2 className="font-bold">{title}</h2>
				<p className="mt-4 text-sm text-on-surface-variant">
					Dados insuficientes para exibir o gráfico.
				</p>
			</div>
		);
	const maximum = Math.max(...values.map((point) => Number(point[field])));
	const chartMaximum = maximum || 1;
	const scale = [maximum, maximum / 2, 0];
	const barThemes = [
		{
			bar: 'border-1 bg-foreground border-primary-fixed-dim',
			label: 'text-primary-fixed',
		},
		{
			bar: 'border-1 bg-foreground border-secondary-fixed-dim',
			label: 'text-secondary-fixed',
		},
		{
			bar: 'border-1 bg-foreground border-tertiary-fixed-dim',
			label: 'text-tertiary-fixed',
		},
	];
	const valueWithUnit = (value: number) =>
		`${format(value)}${unit ? ` ${unit}` : ''}`;
	return (
		<div className="rounded-xl border border-outline-variant p-4">
			<h2 className="font-bold">{title}</h2>
			<p className="mt-1 text-xs text-on-surface-variant">
				Métrica: {metric}
				{unit ? ` (${unit})` : ''} · toque em um índice para ver os detalhes
			</p>
			<div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
				<div
					className="flex h-44 flex-col justify-between pb-6 text-right text-[10px] text-on-surface-variant"
					aria-label={`Escala de ${metric}`}
				>
					{scale.map((value) => (
						<span key={value}>{valueWithUnit(value)}</span>
					))}
				</div>
				<div className="relative h-44 border-b border-l border-outline-variant">
					<div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-outline-variant" />
					<div className="flex h-full items-end justify-around gap-1">
						{values.map((point, index) => {
							const theme = barThemes[0];
							const value = valueWithUnit(Number(point[field]));
							return (
								<button
									key={`${point.date}-${index}`}
									type="button"
									aria-label={`${date(point.date)}: ${value}`}
									onClick={() => setSelected(selected === index ? null : index)}
									className="group flex h-full min-w-8 flex-1 flex-col justify-end focus:outline-none"
								>
									<span
										style={{
											height: `${Math.max(5, (Number(point[field]) / chartMaximum) * 100)}%`,
										}}
										className={`relative block w-full rounded-t transition-colors ${selected === index ? 'bg-primary-container' : `${theme.bar} group-hover:brightness-125`}`}
									>
										<span
											className={`absolute inset-x-0 -top-4 whitespace-nowrap text-center text-[10px] font-semibold ${selected === index ? 'text-primary-fixed' : theme.label}`}
										>
											{value}
										</span>
									</span>
									<span className="mt-1 whitespace-nowrap text-center text-[10px] text-on-surface-variant">
										{shortDate(point.date)}
									</span>
								</button>
							);
						})}
					</div>
					{selected !== null && (
						<div
							role="status"
							className="absolute right-1 top-1 rounded-lg bg-inverse-surface px-2 py-1 text-xs text-inverse-on-surface shadow-lg"
						>
							{date(values[selected].date)} ·{' '}
							{valueWithUnit(Number(values[selected][field]))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function WorkoutAccordion({
	workout,
	labels,
}: {
	workout: ExerciseReviewWorkout;
	labels: ExerciseReviewSummary['exercise']['metrics'];
}) {
	return (
		<details className="group rounded-xl border border-outline-variant bg-surface-container-low">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
				<div>
					<b>{workout.workoutName}</b>
					<p className="mt-1 text-sm text-on-surface-variant">
						{date(workout.performedAt)} · {workout.sets} séries · melhor{' '}
						{format(workout.bestPredictedRm, ' 1RM')} · tonelagem{' '}
						{format(workout.tonnage, ' kg')}
					</p>
				</div>
				<RiArrowDownSLine className="shrink-0 text-xl transition-transform group-open:rotate-180" />
			</summary>
			<div className="border-t border-outline-variant p-4">
				<ExerciseHistorySeriesList
					series={workout.series}
					metric1Label={`${labels[0]?.name ?? 'Métrica'} (${labels[0]?.symbol ?? ''})`}
					metric2Label={labels[1] ? `${labels[1].name} (${labels[1].symbol})` : null}
				/>
			</div>
		</details>
	);
}
