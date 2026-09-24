import type { Metric } from '@/gateway/services/parametro';

/** Returns metrics in the visual entry order while preserving their identities. */
export function getVisualMetricOrder(
	metric1: Metric | undefined,
	metric2: Metric | undefined,
): Array<{ metric: Metric; key: 1 | 2 }> {
	const metrics = [
		...(metric1 ? [{ metric: metric1, key: 1 as const }] : []),
		...(metric2 ? [{ metric: metric2, key: 2 as const }] : []),
	];
	if (isRepetitionsMetric(metric1)) {
		return metrics.toReversed();
	}
	return metrics;
}

export function isRepetitionsMetric(metric: Metric | undefined): boolean {
	return metric?.name
		.trim()
		.toLocaleLowerCase('pt-BR')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') === 'repeticoes';
}
