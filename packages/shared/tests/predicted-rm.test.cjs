const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
function expect(actual) {
  return {
    toBe: (expected) => assert.equal(actual, expected),
    toEqual: (expected) => assert.deepEqual(actual, expected),
    toBeNull: () => assert.equal(actual, null),
    toBeCloseTo: (expected) => assert.ok(Math.abs(actual - expected) < 0.0001),
    toThrow: () => assert.throws(actual),
  };
}
const { tools, tests } = require('../dist');
const { calculatePredictedRm, predictedRmForExecution } = tools;
const { rmReferenceCases } = tests;

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

it('matches the shared RM reference cases', () => {
 for (const item of rmReferenceCases) {
  const actual = calculatePredictedRm(item.weight, item.repetitions);
  if (item.expected === null) assert.equal(actual, null);
  else assert.ok(Math.abs(actual - item.expected) < 0.0001);
 }
});
