import type { PeriodValue } from '@/gateway/services/analysis';

type Props = { label: string; metric: PeriodValue; kind: 'rpe' | 'percent' };
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function color(value: number, kind: Props['kind']) {
	if (kind === 'rpe')
		return value <= 5
			? '#4ade80'
			: value <= 7
				? '#facc15'
				: value <= 9
					? '#fb923c'
					: '#f87171';
	return value <= 30
		? '#f87171'
		: value <= 60
			? '#fb923c'
			: value <= 80
				? '#facc15'
				: '#4ade80';
}

export default function CircularMetric({ label, metric, kind }: Props) {
	const value = metric.current;
	const maximum = kind === 'rpe' ? 10 : 100;
	const progress =
		value === null ? 0 : Math.min(100, Math.max(0, (value / maximum) * 100));
	const valueLabel =
		value === null
			? '—'
			: `${number.format(value)}${kind === 'percent' ? '%' : ''}`;
	const previousLabel =
		metric.previous === null
			? 'Sem dados no período anterior'
			: `Anterior: ${number.format(metric.previous)}${kind === 'percent' ? '%' : ''}`;
	return (
		<article className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
			<div
				className="relative h-20 w-20 shrink-0"
				role="img"
				aria-label={`${label}: ${value === null ? 'sem dados' : valueLabel}`}
			>
				<svg
					viewBox="0 0 80 80"
					className="h-full w-full -rotate-90"
					aria-hidden="true"
				>
					<circle
						cx="40"
						cy="40"
						r="32"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						className="text-outline-variant"
					/>
					{value !== null && (
						<circle
							cx="40"
							cy="40"
							r="32"
							fill="none"
							stroke={color(value, kind)}
							strokeWidth="8"
							strokeLinecap="round"
							strokeDasharray={`${progress * 2.0106} 201.06`}
						/>
					)}
				</svg>
				<span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
					{valueLabel}
				</span>
			</div>
			<div>
				<h3 className="font-semibold">{label}</h3>
				<p className="mt-1 text-xs text-on-surface-variant">{previousLabel}</p>
			</div>
		</article>
	);
}
