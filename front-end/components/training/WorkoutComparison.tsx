import { RiCheckLine, RiCloseLine, RiEditLine } from 'react-icons/ri';
import { MetricFieldType, type Metric } from '@/gateway/services/parametro';
import type { WorkoutExecution } from '@/gateway/services/workouts';

type ComparedValue = {
	label: string;
	value: number | null;
	metric?: Metric;
	type?: 'v' | 'p' | null;
};

function formatValue({ value, metric, type }: Omit<ComparedValue, 'label'>) {
	if (value === null) return { number: '—', unit: '' };
	if (metric?.fieldType === MetricFieldType.TIME && type !== 'p') {
		const minutes = Math.floor(value / 60);
		const seconds = Math.round(value % 60);
		return {
			number: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
			unit: metric.symbol ?? '',
		};
	}
	return { number: String(value), unit: type === 'p' ? '%' : metric?.symbol ?? '' };
}

type DiffValueStatus = 'removed' | 'added' | 'maintained';

const comparisonPresentation = {
	removed: {
		label: 'Valor removido',
		icon: RiCloseLine,
		className: 'border-error/50 bg-error-container/20 text-error',
	},
	added: {
		label: 'Valor novo',
		icon: RiCheckLine,
		className: 'border-primary-fixed-dim/50 bg-primary-fixed-dim/10 text-primary-fixed',
	},
	maintained: {
		label: 'Valor mantido',
		icon: RiEditLine,
		className: 'border-outline-variant bg-surface-variant text-on-surface-variant',
	},
} satisfies Record<DiffValueStatus, { label: string; icon: typeof RiCheckLine; className: string }>;

function DiffValueCards({
	values,
	counterpartValues,
	variant,
}: {
	values: ComparedValue[];
	counterpartValues: ComparedValue[];
	variant: 'expected' | 'performed';
}) {
	const statusFor = (value: number | null, counterpart: number | null): DiffValueStatus => {
		if (value === counterpart || value === null) return 'maintained';
		return variant === 'expected' ? 'removed' : 'added';
	};

	return (
		<>
			{values.map((item, index) => {
				const presentation = comparisonPresentation[statusFor(item.value, counterpartValues[index]?.value ?? null)];
				const formatted = formatValue(item);
				return (
					<div key={item.label} className={`flex min-h-12 min-w-0 flex-wrap items-baseline justify-center gap-1 rounded-lg border px-1.5 py-2 text-center font-mono ${presentation.className}`}>
						<span className="break-all text-sm font-bold leading-tight sm:text-base">{formatted.number}</span>
						{formatted.unit && <span className="break-all text-[0.65rem] font-semibold sm:text-xs">{formatted.unit}</span>}
					</div>
				);
			})}
		</>
	);
}

function executionValues(execution: WorkoutExecution, variant: 'expected' | 'performed') {
	const expected = variant === 'expected';
	return [
		{
			label: execution.exercise.metric_1.name,
			value: expected ? execution.prescribedMetric1 : execution.performedMetric1,
			metric: execution.exercise.metric_1,
			type: execution.metric1Type,
		},
		...(execution.exercise.metric_2
			? [{
					label: execution.exercise.metric_2.name,
					value: expected ? execution.prescribedMetric2 : execution.performedMetric2,
					metric: execution.exercise.metric_2,
					type: execution.metric2Type,
				}]
			: []),
	];
}

export default function WorkoutComparison({ executions }: { executions: WorkoutExecution[] }) {
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
			<div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
				<p className="type-label-caps text-primary-fixed">Comparativo da execução</p>
				<h2 id="workout-comparison-title" className="mt-1 text-xl font-bold">Planejado × realizado</h2>
				<p className="mt-2 text-sm text-on-surface-variant">Compare o planejado e o realizado lado a lado em cada exercício.</p>
				<div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
					{(Object.entries(comparisonPresentation) as [DiffValueStatus, typeof comparisonPresentation.removed][]).map(([status, presentation]) => {
						const Icon = presentation.icon;
						return <span key={status} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${presentation.className}`}><Icon aria-hidden="true" /> {presentation.label}</span>;
					})}
				</div>
			</div>

			{exerciseGroups.map(([exerciseId, sets]) => {
				const exercise = sets[0].exercise;
				return (
					<article key={exerciseId} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
						<div className="border-b border-outline-variant bg-surface-container px-4 py-3 sm:px-5">
							<h3 className="font-bold">{exercise.name}</h3>
							{exercise.description && <p className="mt-1 text-sm text-on-surface-variant">{exercise.description}</p>}
						</div>
						<div className="divide-y divide-outline-variant">
							{sets.map((execution, index) => {
								const expectedValues = executionValues(execution, 'expected');
								const performedValues = execution.status === 'skipped'
									? expectedValues.map((item) => ({ ...item, value: null }))
									: executionValues(execution, 'performed');
								return (
								<div key={execution.id} className="p-4 sm:px-5">
									<div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-3" aria-label={`Comparação da execução ${index + 1}`}>
										<p className="pt-1 font-mono text-sm font-bold text-on-surface-variant">{index + 1}.</p>
										<div>
											{index === 0 && <p className="mb-2 type-label-caps text-on-surface-variant">Esperado</p>}
											<div className="grid grid-cols-2 gap-2" aria-label="Valores esperados">
												<DiffValueCards variant="expected" values={expectedValues} counterpartValues={performedValues} />
											</div>
										</div>
										<div className="border-l border-outline-variant pl-3">
											{index === 0 && <p className="mb-2 type-label-caps text-on-surface-variant">Cumprido</p>}
											<div className="grid grid-cols-2 gap-2" aria-label="Valores cumpridos">
												<DiffValueCards variant="performed" values={performedValues} counterpartValues={expectedValues} />
											</div>
										</div>
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
