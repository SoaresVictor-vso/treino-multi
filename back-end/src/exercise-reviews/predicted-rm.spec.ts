import { calculatePredictedRm, predictedRmForExecution } from './predicted-rm';

describe('predicted 1RM', () => {
	it('uses Brzycki for repetitions from 1 to 36', () => {
		expect(calculatePredictedRm(100, 10)).toBeCloseTo(133.3333);
		expect(calculatePredictedRm(100, 1)).toBe(100);
		expect(calculatePredictedRm(100, 36)).toBe(3600);
	});
	it('rejects invalid or incomplete data without retry state', () => {
		expect(calculatePredictedRm(100, 37)).toBeNull();
		expect(calculatePredictedRm(null, 10)).toBeNull();
		expect(calculatePredictedRm(100, null)).toBeNull();
	});
	it('does not calculate incompatible exercises or unfinished sets', () => {
		expect(predictedRmForExecution({ metric1Name: 'distancia', metric2Name: 'tempo', metric1: 1000, metric2: 300, completed: true })).toBeNull();
		expect(predictedRmForExecution({ metric1Name: 'repeticoes', metric2Name: 'peso', metric1: 10, metric2: 100, completed: false })).toBeNull();
	});
});
