import { seriesTypeClassName } from '@/components/training/SeriesIndicator';

export type ExerciseHistorySeries = {
	position?: number;
	metric1: number | null;
	metric2: number | null;
	predictedRm: number | null;
	setType: string;
	note: string | null;
};

type ExerciseHistorySeriesListProps = {
	series: ExerciseHistorySeries[];
	metric1Label: string;
	metric2Label: string | null;
};

export default function ExerciseHistorySeriesList({
	series,
	metric1Label,
	metric2Label,
}: ExerciseHistorySeriesListProps) {
	const gridClass = (rm: number | null) =>
		typeof rm == 'number' ? 'grid-cols-3' : 'grid-cols-2';
	return (
		<div className="space-y-3">
			{series.map((set, index) => (
				<div
					key={set.position ?? index}
					className="rounded-xl grid grid-cols-6 border border-outline-variant bg-surface-container-low p-3"
				>
					<div className="flex items-center gap-3">
						<span
							className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${seriesTypeClassName[set.setType as keyof typeof seriesTypeClassName] ?? seriesTypeClassName.padrao}`}
						>
							{set.position ?? index + 1}
						</span>
					</div>
					<div
						className={`mt-3 grid gap-2 col-span-5 ${gridClass(set.predictedRm)}`}
					>
						<HistoryValue label={metric1Label} value={set.metric1} />
						{metric2Label && (
							<HistoryValue label={metric2Label} value={set.metric2} />
						)}
						{set.predictedRm && (
							<HistoryValue
								label={`1RM`}
								value={
									set.predictedRm === null ? null : Number(set.predictedRm.toFixed(1))
								}
								highlight
							/>
						)}
					</div>
					{set.note && (
						<p className="mt-3 text-sm text-on-surface-variant">Obs.: {set.note}</p>
					)}
				</div>
			))}
		</div>
	);
}

function HistoryValue({
	label,
	value,
	accent = false,
	highlight = false,
	old = false,
}: {
	label: string;
	value: number | null;
	accent?: boolean;
	highlight?: boolean;
	old?: boolean;
}) {
	if (old)
		return (
			<div
				className={`rounded-lg border px-2 py-2 text-center ${highlight || accent ? 'border-primary-fixed-dim/50 bg-primary-fixed-dim/10 text-primary-fixed' : 'border-outline-variant bg-surface-variant'}`}
			>
				<p className="text-[0.65rem] font-semibold uppercase tracking-wide">
					{label}
				</p>
				<p className="mt-0.5 font-mono text-sm font-bold">
					{value === null ? '—' : `${value}${accent ? ' kg' : ''}`}
				</p>
			</div>
		);

	return (
		<div
			className={`rounded-lg border px-2 py-2 text-center ${highlight || accent ? 'border-primary-fixed-dim/50 bg-primary-fixed-dim/10 text-primary-fixed' : 'border-outline-variant bg-surface-variant'}`}
		>
			<p className="mt-0.5 font-mono text-[10px] font-bold">
				{value === null ? '—' : `${value} ${label}`}
			</p>
		</div>
	);
}
