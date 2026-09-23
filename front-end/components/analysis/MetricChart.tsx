'use client';

import { useState } from 'react';

export type MetricChartCategory = {
	label: string;
	current?: { date: string; value: number };
	previous?: { date: string; value: number };
};

export default function MetricChart({
	metric,
	categories,
	unit,
	pace = false,
	paceFactor = 1,
	formatValue,
	minimumHeight = 0,
}: {
	metric: string;
	categories: MetricChartCategory[];
	unit?: string | null;
	pace?: boolean;
	paceFactor?: number;
	formatValue?: (value: number) => string;
	minimumHeight?: number;
}) {
	const [selected, setSelected] = useState<string | null>(null);
	const values = categories.flatMap((category) =>
		[category.previous?.value, category.current?.value].filter(
			(value): value is number => value !== undefined,
		),
	);
	const fastest = pace && values.length ? Math.min(...values) * paceFactor : 0;
	const slowest = pace && values.length ? Math.max(...values) * paceFactor : 0;
	const paceCeiling = pace
		? Math.max(minimumHeight, slowest + (slowest - fastest) / 9, fastest + 1)
		: 0;
	const maximum = Math.max(1, ...values);
	const ticks = [1, 0.5, 0];
	const format = (value: number) =>
		formatValue?.(value) ??
		`${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;
	const axisFormat = (fraction: number) => {
		const value = pace
			? (fastest + (paceCeiling - fastest) * (1 - fraction)) / paceFactor
			: maximum * fraction;
		return format(value);
	};
	const height = (value: number) =>
		pace
			? Math.max(
					10,
					((paceCeiling - value * paceFactor) / (paceCeiling - fastest)) * 100,
				)
			: Math.max(3, (value / maximum) * 100);

	if (!categories.length)
		return (
			<p className="mt-4 text-sm text-on-surface-variant">
				Dados insuficientes para exibir o gráfico.
			</p>
		);

	return (
		<div className="mt-5 min-w-0 max-w-full overflow-x-auto pb-2 pt-7">
			<div
				className="flex min-w-0 gap-2"
				style={{ minWidth: `${Math.max(0, categories.length * 38)}px` }}
			>
				<div
					className="flex h-40 shrink-0 flex-col justify-between text-right text-[9px] text-on-surface-variant"
					aria-label={`Escala de ${metric}`}
				>
					{ticks.map((tick) => (
						<span key={tick}>{axisFormat(tick)}</span>
					))}
				</div>
				<div className="min-w-0 flex-1">
					<div className="relative flex h-40 items-end border-b border-l border-outline-variant">
						{ticks.map((tick) => (
							<div
								key={tick}
								className="pointer-events-none absolute inset-x-0 border-t border-dashed border-outline-variant/60"
								style={{ bottom: `${tick * 100}%` }}
							/>
						))}
						{categories.map((category) => (
							<div
								key={category.label}
								className="group relative z-[1] flex h-full min-w-0 flex-1 flex-col items-center justify-end"
							>
								<div className="flex h-full w-full min-w-0 items-end justify-center gap-0.5">
									{category.previous && (
										<button
											type="button"
											aria-label={`Período anterior, ${category.previous.date}: ${format(category.previous.value)}`}
											onClick={() =>
												setSelected(
													selected === `previous-${category.label}`
														? null
														: `previous-${category.label}`,
												)
											}
											className="relative w-full max-w-5 cursor-pointer rounded-t bg-secondary-fixed-dim hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-fixed-dim"
											style={{ height: `${height(category.previous.value)}%` }}
										>
											<span className="absolute inset-x-0 -top-4 whitespace-nowrap text-center text-[9px] font-semibold text-secondary-fixed">
												{format(category.previous.value)}
											</span>
										</button>
									)}
									{category.current && (
										<button
											type="button"
											aria-label={`Atual, ${category.current.date}: ${format(category.current.value)}`}
											onClick={() =>
												setSelected(
													selected === `current-${category.label}`
														? null
														: `current-${category.label}`,
												)
											}
											className="relative w-full max-w-5 cursor-pointer rounded-t bg-primary-fixed hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-fixed"
											style={{ height: `${height(category.current.value)}%` }}
										>
											<span className="absolute inset-x-0 -top-4 whitespace-nowrap text-center text-[9px] font-semibold text-primary-fixed">
												{format(category.current.value)}
											</span>
										</button>
									)}
								</div>
								<span className="mt-1 whitespace-nowrap text-center text-[9px] text-on-surface-variant">
									{category.label}
								</span>
							</div>
						))}
						{selected && (
							<span
								role="status"
								className="absolute right-1 top-1 z-10 rounded bg-inverse-surface px-2 py-1 text-[10px] text-inverse-on-surface"
							>
								{selected.startsWith('previous-') ? 'Período anterior' : 'Atual'} ·{' '}
								{selected.slice(selected.indexOf('-') + 1)}
							</span>
						)}
					</div>
				</div>
			</div>
			<div className="mt-2 flex justify-end gap-3 text-[10px] text-on-surface-variant">
				<span className="flex items-center gap-1">
					<i className="h-2.5 w-2.5 rounded-sm bg-primary-fixed" />
					Atual
				</span>
				<span className="flex items-center gap-1">
					<i className="h-2.5 w-2.5 rounded-sm bg-secondary-fixed-dim" />
					Período anterior
				</span>
			</div>
		</div>
	);
}
