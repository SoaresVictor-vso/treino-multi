'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ErrorBox from '@/components/ui/ErrorBox';
import {
	analysisService,
	type AthleteAnalysis,
} from '@/gateway/services/analysis';
import AnalysisPeriodFilter, {
	type AnalysisDays,
} from './AnalysisPeriodFilter';
import AnalysisIndicators from './AnalysisIndicators';
import MeasurementCharts from './MeasurementCharts';
import LifetimeStats from './LifetimeStats';
import AthleteExerciseList from './AthleteExerciseList';

export default function AnalysisDashboard({
	athleteId,
	showBack = false,
}: {
	athleteId: string;
	showBack?: boolean;
}) {
	const [days, setDays] = useState<AnalysisDays>(7);
	const [data, setData] = useState<AthleteAnalysis | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		let active = true;
		void analysisService.athlete(athleteId, days).then((response) => {
			if (!active) return;
			setData(response.success ? (response.data ?? null) : null);
			setError(
				response.success
					? null
					: (response.error ?? 'Não foi possível carregar a análise.'),
			);
			setLoading(false);
		});
		return () => {
			active = false;
		};
	}, [athleteId, days]);
	const measurementValue = (key: string) => {
		const measurement = data?.measurements.find((item) => item.key === key);
		return {
			current: measurement?.currentTotal ?? null,
			previous: measurement?.previousTotal ?? null,
		};
	};
	const indicators = {
		averageRpe: measurementValue('average-rpe'),
		adherence: measurementValue('workout-adherence'),
		rpeAdherence: measurementValue('rpe-adherence'),
	};
	console.log(indicators);
	return (
		<main className="mx-auto max-w-7xl space-y-7 p-4 sm:p-8">
			{showBack && (
				<Link
					href={`/athlete/${athleteId}`}
					className="text-sm font-semibold text-primary-fixed"
				>
					← Voltar para treinos
				</Link>
			)}
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="type-label-caps text-primary-fixed">Análise do atleta</p>
					<h1 className="mt-1 text-3xl font-bold">
						{data?.athleteName ?? 'Sua evolução'}
					</h1>
				</div>
				<AnalysisPeriodFilter
					days={days}
					onChange={(value) => {
						if (value === '3m') return;
						setLoading(true);
						setData(null);
						setDays(value);
					}}
				/>
			</div>
			{error && <ErrorBox message={error} />}
			{loading && <p className="text-on-surface-variant">Carregando análise...</p>}
			{data && (
				<>
					<AnalysisIndicators indicators={indicators} />
					<MeasurementCharts
						measurements={data.measurements}
						days={days}
						startDay={data.period.currentStartDay}
						previousStartDay={data.period.previousStartDay}
					/>
					<LifetimeStats stats={data.lifetime} />
					<AthleteExerciseList athleteId={athleteId} exercises={data.exercises} />
				</>
			)}
		</main>
	);
}
