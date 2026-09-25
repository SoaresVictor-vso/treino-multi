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
const {
	createZeroState,
	evaluateValueFormula,
	executeFormula,
	validateFormula,
} = require('../dist/tools/formula-engine');
const { MEASUREMENT_DEFINITIONS } = require('../dist/constants/measurements.constants');

const definition = (key) => {
	const found = MEASUREMENT_DEFINITIONS.find(
		(measurement) => measurement.key === key,
	);
	if (!found) throw new Error(`Missing measurement definition: ${key}`);
	return found;
};

const executionFields = [
	'duration',
	'rpe',
	'prescribedRpe',
	'completed',
	'prescribedMetric1',
	'metricsMatch',
];

describe('formula engine', () => {
	it('validates formulas and value formulas from all measurement definitions', () => {
		const allowedFields = [
			...executionFields,
			...MEASUREMENT_DEFINITIONS.flatMap((measurement) =>
				[measurement.metric1Name, measurement.metric2Name].filter(
					(name) => name !== null,
				),
			),
		];

		for (const measurement of MEASUREMENT_DEFINITIONS) {
			validateFormula(measurement.formula, allowedFields, true);
			validateFormula(measurement.valueFormula, [], false);
		}
	});

	it('calculates tonnage from its registered formula', () => {
		const tonnage = definition('tonnage');
		const curr = createZeroState();
		for (const item of [
			{ peso: 100, repeticoes: 5 },
			{ peso: 80, repeticoes: 8 },
		])
			executeFormula(tonnage.formula, curr, item);

		expect(evaluateValueFormula(tonnage.valueFormula, curr)).toBe(1140);
	});

	it('calculates pace from its registered formula', () => {
		const pace = definition('average-pace');
		const curr = createZeroState();
		for (const item of [
			{ distancia: 1000, tempo: 300 },
			{ distancia: 2000, tempo: 660 },
		])
			executeFormula(pace.formula, curr, item);

		expect(evaluateValueFormula(pace.valueFormula, curr)).toBeCloseTo(0.32);
	});

	it('calculates duration and average RPE using their registered formulas', () => {
		const duration = definition('duration');
		const durationState = createZeroState();
		executeFormula(duration.formula, durationState, { duration: 120 });
		expect(evaluateValueFormula(duration.valueFormula, durationState)).toBe(120);

		const averageRpe = definition('average-rpe');
		const rpeState = createZeroState();
		for (const rpe of [8, 6])
			executeFormula(averageRpe.formula, rpeState, { rpe });
		expect(evaluateValueFormula(averageRpe.valueFormula, rpeState)).toBe(7);
	});

	it('calculates RPE adherence using its registered formula', () => {
		const rpeAdherence = definition('effort-adherence');
		const curr = createZeroState();
		for (const [rpe, prescribedRpe] of [
			[7, 7],
			[9, 7],
			[6, null],
		])
			executeFormula(rpeAdherence.formula, curr, { rpe, prescribedRpe });

		expect(evaluateValueFormula(rpeAdherence.valueFormula, curr)).toBeCloseTo(
			100 / 3,
		);
	});

	it('counts all sets, including unprescribed skipped sets', () => {
		const adherence = definition('workout-adherence');
		const curr = createZeroState();
		const sets = [
			{ completed: true, metricsMatch: true, prescribedMetric1: 8 },
			{ completed: true, metricsMatch: false, prescribedMetric1: 8 },
			{ completed: false, metricsMatch: false, prescribedMetric1: 8 },
			{ completed: false, metricsMatch: false, prescribedMetric1: null },
		];

		for (const set of sets) executeFormula(adherence.formula, curr, set);

		expect(curr.count).toBe(3);
		expect(curr.points).toBe(3);
		expect(evaluateValueFormula(adherence.valueFormula, curr)).toBe(50);
	});

	it('returns zero for average RPE with no values and rejects unsafe formulas', () => {
		const averageRpe = definition('average-rpe');
		expect(evaluateValueFormula(averageRpe.valueFormula, createZeroState())).toBe(
			0,
		);
		expect(() => validateFormula('curr.__proto__ = 1', ['peso'], true)).toThrow();
		expect(() => validateFormula('process.exit', ['peso'], true)).toThrow();
		expect(() =>
			validateFormula('curr.total = peso()', ['peso'], true),
		).toThrow();
		expect(() =>
			validateFormula('curr.total = unknown', ['peso'], true),
		).toThrow();
	});
});

const { tests } = require('../dist');
const { formulaReferenceCases } = tests;
it('matches the shared formula reference cases', () => {
 for (const item of formulaReferenceCases) {
  const definition = MEASUREMENT_DEFINITIONS.find((entry) => entry.key === item.key);
  const curr = createZeroState();
  for (const context of item.contexts) executeFormula(definition.formula, curr, context);
  assert.ok(Math.abs(evaluateValueFormula(definition.valueFormula, curr) - item.expected) < 0.0001);
 }
});
