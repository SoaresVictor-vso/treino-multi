import {
	createZeroState,
	evaluateValueFormula,
	executeFormula,
	validateFormula,
} from './formula-engine';

describe('formula engine', () => {
	it('initializes arbitrary curr properties with zero and accumulates safely', () => {
		const curr = createZeroState();
		executeFormula(
			'curr.total = curr.total + peso * repeticoes; curr.count = curr.count + 1',
			curr,
			{ peso: 10, repeticoes: 8 },
		);
		executeFormula(
			'curr.total = curr.total + peso * repeticoes; curr.count = curr.count + 1',
			curr,
			{ peso: 20, repeticoes: 5 },
		);
		expect(curr.total).toBe(180);
		expect(curr.count).toBe(2);
		expect(evaluateValueFormula('curr.total / curr.count', curr)).toBe(90);
	});

	it('supports allowed execution fields and has deterministic zero division', () => {
		const curr = createZeroState();
		executeFormula('curr.total = curr.total + rpe + prescribedRpe', curr, {
			rpe: 8,
			prescribedRpe: 7,
		});
		expect(curr.total).toBe(15);
		expect(evaluateValueFormula('curr.total / curr.none', curr)).toBe(0);
	});

	it('calculates the seeded aggregate formula shapes', () => {
		const tonnage = createZeroState();
		for (const item of [
			{ peso: 100, repeticoes: 5 },
			{ peso: 80, repeticoes: 8 },
		])
			executeFormula('curr.total = curr.total + peso * repeticoes', tonnage, item);
		expect(evaluateValueFormula('curr.total', tonnage)).toBe(1140);

		const pace = createZeroState();
		for (const item of [
			{ distancia: 1000, tempo: 300 },
			{ distancia: 2000, tempo: 660 },
		])
			executeFormula(
				'curr.distance = curr.distance + distancia; curr.duration = curr.duration + tempo',
				pace,
				item,
			);
		expect(
			evaluateValueFormula('curr.duration / curr.distance', pace),
		).toBeCloseTo(0.32);

		const adherence = createZeroState();
		for (const metricsMatch of [true, false, true])
			executeFormula(
				'curr.points = curr.points + completed * (1 + metricsMatch); curr.count = curr.count + 1',
				adherence,
				{ completed: true, metricsMatch },
			);
		expect(
			evaluateValueFormula('(curr.points / (2 * curr.count)) * 100', adherence),
		).toBeCloseTo(83.333);
	});

	it('includes skipped sets in workout adherence count', () => {
		const adherence = createZeroState();
		const formula =
			'curr.points = curr.points + completed * (1 + metricsMatch); curr.count = curr.count + 1';
		executeFormula(formula, adherence, {
			completed: true,
			metricsMatch: true,
		});
		executeFormula(formula, adherence, {
			completed: false,
			metricsMatch: false,
		});
		expect(adherence.count).toBe(2);
		expect(adherence.points).toBe(2);
		expect(
			evaluateValueFormula('(curr.points / (2 * curr.count)) * 100', adherence),
		).toBe(50);
	});

	it('scores matching sets two, mismatched sets one, and skipped sets zero', () => {
		const adherence = createZeroState();
		const formula =
			'curr.points = curr.points + completed * (1 + metricsMatch); curr.count = curr.count + 1';
		const sets = [
			...Array.from({ length: 3 }, () => ({
				completed: true,
				metricsMatch: true,
			})),
			{
				completed: true,
				metricsMatch: false,
			},
			{
				completed: false,
				metricsMatch: true,
			},
		];

		for (const set of sets) executeFormula(formula, adherence, set);

		expect(adherence.count).toBe(5);
		expect(adherence.points).toBe(7);
		expect(
			evaluateValueFormula('(curr.points / (2 * curr.count)) * 100', adherence),
		).toBe(70);
	});

	it('rejects unsafe and malformed formulas', () => {
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
