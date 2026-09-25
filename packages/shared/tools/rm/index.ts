import type { PredictedRmExecution } from '../../types';
/** Brzycki 1RM. `null` means that the set is not eligible for this formula. */
export function calculatePredictedRm(
	weight: number | null | undefined,
	repetitions: number | null | undefined,
): number | null {
	if (
		weight === null || weight === undefined || !Number.isFinite(weight) || weight <= 0 ||
		repetitions === null || repetitions === undefined || !Number.isFinite(repetitions) ||
		!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 36
	)
		return null;
	return (weight * 36) / (37 - repetitions);
}

export function hasWeightAndRepetitions(
	metric1: string | null | undefined,
	metric2: string | null | undefined,
) {
	return [metric1, metric2].filter(Boolean).sort().join('|') === 'peso|repeticoes';
}

/** Values are stored according to the exercise metric ordering. */
export function predictedRmForExecution(input: PredictedRmExecution): number | null {
	if (!input.completed || !hasWeightAndRepetitions(input.metric1Name, input.metric2Name)) return null;
	const weight = input.metric1Name === 'peso' ? input.metric1 : input.metric2;
	const repetitions = input.metric1Name === 'repeticoes' ? input.metric1 : input.metric2;
	return calculatePredictedRm(weight, repetitions);
}
