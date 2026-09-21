'use client';

import { useState } from 'react';
import {
	RiCheckLine,
	RiCloseLine,
	RiEditLine,
	RiInformationLine,
	RiUserAddLine,
} from 'react-icons/ri';
import { MetricFieldType, type Metric } from '@/gateway/services/parametro';
import type { WorkoutExecution } from '@/gateway/services/workouts';
import SeriesIndicator, { seriesTypeClassName } from './SeriesIndicator';
import RpeIndicator from './RpeIndicator';

type ComparedValue = {
	label: string;
	value: number | null;
	metric?: Metric;
	type?: 'v' | 'p' | null;
};

function formatValue({ value, metric, type }: Omit<ComparedValue, 'label'>) {
	if (value === null) return { number: '—', unit: '' };
	if (metric?.fieldType === MetricFieldType.TIME && type !== 'p') {
		const totalSeconds = Math.round(value);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return {
			number: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
			unit: metric.symbol ?? '',
		};
	}
	return {
		number: String(value),
		unit: type === 'p' ? '%' : (metric?.symbol ?? ''),
	};
}

type DiffValueStatus = 'removed' | 'added' | 'maintained';

const comparisonPresentation = ({ isDone }: { isDone: boolean }) =>
	({
		removed: {
			label: 'Valor removido',
			icon: RiCloseLine,
			className: `border-error/50 ${isDone ? 'bg-error-container/20' : ''} text-error`,
		},
		added: {
			label: 'Valor novo',
			icon: RiUserAddLine,
			className: `border-primary-fixed-dim/50 ${isDone ? 'bg-primary-fixed-dim/10' : ''} text-primary-fixed`,
		},
		maintained: {
			label: 'Valor mantido',
			icon: RiEditLine,
			className: `border-outline-variant ${isDone ? 'bg-surface-variant' : ''} text-on-surface-variant`,
		},
	}) satisfies Record<
		DiffValueStatus,
		{ label: string; icon: typeof RiCheckLine; className: string }
	>;

function DiffValueCards({
	values,
	counterpartValues,
	variant,
	isDone,
}: {
	values: ComparedValue[];
	counterpartValues: ComparedValue[];
	variant: 'expected' | 'performed';
	isDone: boolean;
}) {
	const statusFor = (
		value: number | null,
		counterpart: number | null,
	): DiffValueStatus => {
		if (value === counterpart || value === null) return 'maintained';
		return variant === 'expected' ? 'removed' : 'added';
	};

	return (
		<>
			{values.map((item, index) => {
				const counterpart = counterpartValues[index]?.value ?? null;
				const showValue =
					item.value !== null &&
					(counterpart === null ||
						item.value !== counterpart ||
						variant === 'performed');
				if (!showValue) return null;
				const presentation = comparisonPresentation({ isDone })[
					statusFor(item.value, counterpart)
				];
				const formatted = formatValue(item);
				return (
					<div
						key={item.label}
						className={`flex min-h-12 min-w-0 flex-wrap items-baseline justify-center gap-1 rounded-lg border px-1.5 py-2 text-center font-mono ${presentation.className}`}
					>
						<span className="break-all text-sm font-bold leading-tight sm:text-base">
							{formatted.number}
						</span>
						{formatted.unit && (
							<span className="break-all text-[0.65rem] font-semibold sm:text-xs">
								{formatted.unit}
							</span>
						)}
					</div>
				);
			})}
		</>
	);
}

function executionValues(
	execution: WorkoutExecution,
	variant: 'expected' | 'performed',
) {
	const expected = variant === 'expected';
	const values: ComparedValue[] = [
		{
			label: execution.exercise.metric_1.name,
			value: expected ? execution.prescribedMetric1 : execution.performedMetric1,
			metric: execution.exercise.metric_1,
			type: execution.metric1Type,
		},
		...(execution.exercise.metric_2
			? [
					{
						label: execution.exercise.metric_2.name,
						value: expected
							? execution.prescribedMetric2
							: execution.performedMetric2,
						metric: execution.exercise.metric_2,
						type: execution.metric2Type,
					},
				]
			: []),
	];
	return values;
}

export default function WorkoutComparison({
	executions,
}: {
	executions: WorkoutExecution[];
}) {
	const [legendOpen, setLegendOpen] = useState(false);
	const exerciseGroups = Array.from(
		new Map<number, WorkoutExecution[]>(
			executions
				.toSorted((left, right) => left.position - right.position)
				.map((execution) => [
					execution.exerciseId,
					executions
						.filter((item) => item.exerciseId === execution.exerciseId)
						.toSorted((left, right) => left.position - right.position),
				]),
		).entries(),
	);

	return (
		<section className="space-y-5" aria-labelledby="workout-comparison-title">
			<div className="flex items-start justify-between gap-3 px-1">
				<div>
					<p className="type-label-caps text-primary-fixed">
						Comparativo da execução
					</p>
					<h2 id="workout-comparison-title" className="mt-1 text-xl font-bold">
						Planejado × realizado
					</h2>
				</div>
					<button
						type="button"
						className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-outline-variant text-on-surface-variant transition hover:bg-surface-variant hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
						onClick={() => setLegendOpen((open) => !open)}
						aria-label={legendOpen ? 'Ocultar legenda de cores' : 'Mostrar legenda de cores'}
						aria-expanded={legendOpen}
					>
						<RiInformationLine size={19} aria-hidden="true" />
					</button>
				</div>
			{legendOpen && <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5" aria-label="Legenda de cores">
				<p className="text-sm text-on-surface-variant">
					Compare o planejado e o realizado lado a lado em cada exercício.
				</p>
				<div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
					{(
						Object.entries(comparisonPresentation({ isDone: true })) as [
							DiffValueStatus,
							{ label: string; icon: typeof RiCheckLine; className: string },
						][]
					).map(([status, presentation]) => {
						const Icon = presentation.icon;
						return (
							<span
								key={status}
								className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${presentation.className}`}
							>
								<Icon aria-hidden="true" /> {presentation.label}
							</span>
						);
					})}
				</div>
			</div>}

			{exerciseGroups.map(([exerciseId, sets]) => {
				const exercise = sets[0].exercise;
				const isAthleteAdded = sets.every(
					({ prescribedMetric1, prescribedMetric2, prescribedPse }) =>
						prescribedMetric1 === null &&
						prescribedMetric2 === null &&
						(prescribedPse ?? 0) === 0,
				);
				return (
					<article
						key={exerciseId}
						className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
					>
						<div className="border-b border-outline-variant bg-surface-container px-4 py-3 sm:px-5">
							<div className="flex items-center gap-2">
								<h3 className="font-bold">{exercise.name}</h3>
								{isAthleteAdded && (
									<span
										className="inline-flex text-on-surface-variant"
										title="Adicionado pelo atleta"
										aria-label="Adicionado pelo atleta"
									>
										<RiUserAddLine aria-hidden="true" />
									</span>
								)}
							</div>
							{exercise.description && (
								<p className="mt-1 text-sm text-on-surface-variant">
									{exercise.description}
								</p>
							)}
						</div>
						<div className="divide-y divide-outline-variant">
							{sets.map((execution, index) => {
								const includeRpe =
									(execution.prescribedPse ?? 0) > 0 ||
									(execution.performedPse ?? 0) > 0;
								const expectedValues = executionValues(execution, 'expected');
								const performedValues =
									execution.status === 'skipped'
										? expectedValues.map((item) => ({ ...item, value: null }))
										: executionValues(execution, 'performed');
								const showExpectedRpe =
									(execution.prescribedPse ?? 0) > 0 &&
									((execution.performedPse ?? 0) === 0 ||
										execution.performedPse !== execution.prescribedPse);
				const showPerformedRpe =
					execution.status !== 'skipped' &&
					((execution.performedPse ?? 0) > 0 ||
					((execution.prescribedPse ?? 0) > 0 &&
						execution.performedPse === execution.prescribedPse));
								const hasMetricDifference = expectedValues.some(
									(item, valueIndex) =>
										item.value !== null &&
										performedValues[valueIndex]?.value !== null &&
										item.value !== performedValues[valueIndex]?.value,
								);
								const hasRpeDifference =
									(execution.prescribedPse ?? 0) > 0 &&
									(execution.performedPse ?? 0) > 0 &&
									execution.prescribedPse !== execution.performedPse;
								const hasComparisonDifference = hasMetricDifference || hasRpeDifference;
				const hasPerformedValue =
					execution.status !== 'skipped' &&
					(performedValues.some((item) => item.value !== null) ||
						(execution.performedPse ?? 0) > 0);
								const hasPrescribedValue =
									expectedValues.some((item) => item.value !== null) ||
									(execution.prescribedPse ?? 0) > 0;
								const prescriptionOnly = hasPrescribedValue && !hasPerformedValue;
								const comparisonSide = hasComparisonDifference
									? 'both'
									: hasPerformedValue
										? 'performed'
										: prescriptionOnly
											? 'both'
											: 'expected';

								const isDone = execution.status == 'completed';
								return (
									<div key={execution.id} className="p-4 sm:px-5">
										<div
											className={`grid gap-3 ${isAthleteAdded || comparisonSide !== 'both' ? 'grid-cols-[1.5rem_minmax(0,1fr)]' : 'grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)]'}`}
											aria-label={`Comparação da execução ${index + 1}`}
										>
											<SeriesIndicator
												number={index + 1}
												completed={isDone}
												className={seriesTypeClassName[execution.setType]}
															tooltip={
																isDone ? `Série ${index + 1} concluída` : `Série ${index + 1}`
															}
													/>
													{!hasPrescribedValue && !hasPerformedValue && (
														<div className="self-center text-sm font-semibold text-error">
															Não executado
														</div>
													)}
													{!isAthleteAdded && comparisonSide !== 'performed' && (
												<div>
													<div
														className="flex min-w-0 items-center gap-2"
														aria-label="Valores esperados"
													>
														<div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2">
															<DiffValueCards
																variant="expected"
																values={expectedValues}
																counterpartValues={performedValues}
																isDone={isDone}
															/>
														</div>
														{includeRpe && showExpectedRpe && (
															<RpeIndicator
																prescribed={execution.prescribedPse}
																performed={execution.performedPse}
																mode="expected"
																compact
																showComparison={false}
															/>
														)}
													</div>
												</div>
											)}
											{comparisonSide !== 'expected' && (
												<div
													className={
														comparisonSide === 'both'
															? 'border-l border-outline-variant pl-3'
															: ''
													}
												>
													<div
														className="flex min-w-0 items-center gap-2"
														aria-label="Valores cumpridos"
													>
														<div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2">
															{prescriptionOnly ? (
																<span className="col-span-full self-center text-sm font-semibold text-error">
																	Não executado
																</span>
															) : (
																<DiffValueCards
																	variant="performed"
																	values={performedValues}
																	counterpartValues={expectedValues}
																	isDone={isDone}
																/>
															)}
														</div>
														{includeRpe && showPerformedRpe && (
															<RpeIndicator
																prescribed={execution.prescribedPse}
																performed={execution.performedPse}
																compact
																showComparison={false}
															/>
														)}
													</div>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</article>
				);
			})}
		</section>
	);
}
