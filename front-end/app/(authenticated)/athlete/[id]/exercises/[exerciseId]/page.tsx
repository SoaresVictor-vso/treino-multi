'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiArrowDownSLine, RiArrowLeftLine } from 'react-icons/ri';
import ErrorBox from '@/components/ui/ErrorBox';
import { getSessionUser } from '@/lib/auth';
import ExerciseHistorySeriesList from '@/components/shared/ExerciseHistorySeriesList';
import AnalysisPeriodFilter, {
	type AnalysisPeriod,
} from '@/components/analysis/AnalysisPeriodFilter';
import AnalysisIndicators from '@/components/analysis/AnalysisIndicators';
import LifetimeStats from '@/components/analysis/LifetimeStats';
import MetricChart, {
	type MetricChartCategory,
} from '@/components/analysis/MetricChart';
import {
	analysisService,
	type ExerciseAnalysis,
} from '@/gateway/services/analysis';
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
const formatPace = (value: number) => {
	const totalSeconds = Math.round(value * 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
const formatDistance = (value: number) => numberFormat.format(value / 1000);
const formatDuration = (value: number) => {
	const totalSeconds = Math.round(value);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0)
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
	return `0:${String(seconds).padStart(2, '0')}`;
};
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
	const isAthlete = getSessionUser()?.sub === athleteId;
	const router = useRouter();
	const [summary, setSummary] = useState<ExerciseReviewSummary | null>(null);
	const [workouts, setWorkouts] = useState<ExerciseReviewWorkout[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [period, setPeriod] = useState<AnalysisPeriod>('3m');
	const [analysis, setAnalysis] = useState<ExerciseAnalysis | null>(null);
	const [analysisError, setAnalysisError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void analysisService
			.exercise(athleteId, exerciseId, period)
			.then((response) => {
				if (!active) return;
				setAnalysis(response.success ? (response.data ?? null) : null);
				setAnalysisError(
					response.success
						? null
						: (response.error ?? 'Não foi possível carregar a análise.'),
				);
			});
		return () => {
			active = false;
		};
	}, [athleteId, exerciseId, period]);

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
		<main className="mx-auto min-w-0 max-w-5xl p-4 sm:p-8">
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
					{!isAthlete && summary?.athleteName && (
						<p className="mt-1 text-sm text-on-surface-variant">
							{summary.athleteName}
						</p>
					)}
				</div>
				<p className="text-sm text-on-surface-variant">
					Histórico: últimos 3 meses
				</p>
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
					<section className="mt-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
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
							unit={
								isWeightReps ? 'kg' : metrics.includes('distancia') ? 'km' : undefined
							}
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
							unit={
								isWeightReps
									? 'kg'
									: metrics.includes('distancia')
										? 'min/km'
										: undefined
							}
							points={summary.charts}
							field={secondaryField}
						/>
					</section>
					<section className="mt-8 space-y-4">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<p className="type-label-caps text-primary-fixed">Exercício</p>
								<h2 className="text-xl font-bold">Estatísticas do período</h2>
							</div>
							<AnalysisPeriodFilter
								days={period}
								onChange={setPeriod}
								includeThreeMonths
							/>
						</div>
						{analysisError && <ErrorBox message={analysisError} />}
						{analysis && <AnalysisIndicators indicators={analysis.indicators} />}
					</section>
					{analysis && (
						<div className="mt-8">
							<LifetimeStats stats={analysis.lifetime} exercise />
						</div>
					)}
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
	const isPace = field === 'pace';
	const isDistance = field === 'distance';
	const values = points.flatMap((point) => {
		const value = point[field];
		return typeof value === 'number'
			? [{ label: shortDate(point.date), current: { date: point.date, value } }]
			: [];
	});
	const categories: MetricChartCategory[] = values;
	const formatChartValue = (value: number) =>
		isPace
			? `${formatPace(value)} min/km`
			: isDistance
				? formatDistance(value)
				: field === 'duration'
					? formatDuration(value)
					: format(value);
	return (
		<div className="min-w-0 max-w-full rounded-xl border border-outline-variant p-4">
			<h2 className="font-bold">{title}</h2>
			<p className="mt-1 text-xs text-on-surface-variant">
				Métrica: {metric}
				{unit ? ` (${unit})` : ''} · toque em uma coluna para ver os detalhes
			</p>
			<MetricChart
				metric={metric}
				categories={categories}
				unit={field === 'duration' ? 's' : unit}
				pace={isPace}
				paceFactor={1000}
				minimumHeight={isPace ? 600 : undefined}
				formatValue={formatChartValue}
			/>
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
						{date(workout.performedAt)}
					</p>
				</div>
				<RiArrowDownSLine className="shrink-0 text-xl transition-transform group-open:rotate-180" />
			</summary>
			<div className="border-t border-outline-variant p-4">
				<ExerciseHistorySeriesList
					series={workout.series}
					metric1Label={`${labels[0]?.symbol ?? 'Métrica'}`}
					metric2Label={labels[1]?.symbol || null}
				/>
			</div>
		</details>
	);
}
