import { createZeroState, evaluateValueFormula, executeFormula, validateFormula } from './formula-engine';

describe('formula engine', () => {
	it('initializes arbitrary curr properties with zero and accumulates safely', () => {
		const curr = createZeroState();
		executeFormula('curr.total = curr.total + peso * repeticoes; curr.count = curr.count + 1', curr, { peso: 10, repeticoes: 8 });
		executeFormula('curr.total = curr.total + peso * repeticoes; curr.count = curr.count + 1', curr, { peso: 20, repeticoes: 5 });
		expect(curr.total).toBe(180);
		expect(curr.count).toBe(2);
		expect(evaluateValueFormula('curr.total / curr.count', curr)).toBe(90);
	});

	it('supports allowed execution fields and has deterministic zero division', () => {
		const curr = createZeroState();
		executeFormula('curr.total = curr.total + rpe + prescribedRpe', curr, { rpe: 8, prescribedRpe: 7 });
		expect(curr.total).toBe(15);
		expect(evaluateValueFormula('curr.total / curr.none', curr)).toBe(0);
	});

	it('calculates the seeded aggregate formula shapes', () => {
		const tonnage = createZeroState();
		for (const item of [{ peso: 100, repeticoes: 5 }, { peso: 80, repeticoes: 8 }])
			executeFormula('curr.total = curr.total + peso * repeticoes', tonnage, item);
		expect(evaluateValueFormula('curr.total', tonnage)).toBe(1140);

		const pace = createZeroState();
		for (const item of [{ distancia: 1000, tempo: 300 }, { distancia: 2000, tempo: 660 }])
			executeFormula('curr.distance = curr.distance + distancia; curr.duration = curr.duration + tempo', pace, item);
		expect(evaluateValueFormula('curr.duration / curr.distance', pace)).toBeCloseTo(0.32);

		const adherence = createZeroState();
		for (const completed of [true, false, true])
			executeFormula('curr.completed = curr.completed + completed; curr.count = curr.count + 1', adherence, { completed });
		expect(evaluateValueFormula('(curr.completed / curr.count) * 100', adherence)).toBeCloseTo(66.666);
	});

	it('includes skipped sets in workout adherence count', () => {
		const adherence = createZeroState();
		const formula =
			'curr.completed = curr.completed + (completed === 1) * (prescribedMetric1 > 0) * (performedMetric1 === prescribedMetric1) * (((hasMetric2 === 0) + ((hasMetric2 === 1) * (prescribedMetric2 > 0) * (performedMetric2 === prescribedMetric2))) > 0); curr.count = curr.count + 1';
		executeFormula(formula, adherence, {
			completed: true,
			prescribedMetric1: 10,
			performedMetric1: 10,
			prescribedMetric2: null,
			performedMetric2: null,
			hasMetric2: 0,
		});
		executeFormula(formula, adherence, {
			completed: false,
			prescribedMetric1: 10,
			performedMetric1: null,
			prescribedMetric2: null,
			performedMetric2: null,
			hasMetric2: 0,
		});
		expect(adherence.count).toBe(2);
		expect(adherence.completed).toBe(1);
		expect(evaluateValueFormula('(curr.completed / curr.count) * 100', adherence)).toBe(50);
	});

	it('calculates the adherence example with 3 of 8 sets', () => {
		const adherence = createZeroState();
		const formula =
			'curr.completed = curr.completed + (completed === 1) * (prescribedMetric1 > 0) * (performedMetric1 === prescribedMetric1) * (((hasMetric2 === 0) + ((hasMetric2 === 1) * (prescribedMetric2 > 0) * (performedMetric2 === prescribedMetric2))) > 0); curr.count = curr.count + 1';
		const sets = [
			...Array.from({ length: 3 }, () => ({
				completed: true,
				prescribedMetric1: 5,
				performedMetric1: 5,
				prescribedMetric2: 40,
				performedMetric2: 40,
				hasMetric2: 1,
			})),
			{
				completed: true,
				prescribedMetric1: 5,
				performedMetric1: 5,
				prescribedMetric2: 40,
				performedMetric2: 50,
				hasMetric2: 1,
			},
			{
				completed: false,
				prescribedMetric1: 5,
				performedMetric1: 5,
				prescribedMetric2: 40,
				performedMetric2: 40,
				hasMetric2: 1,
			},
			...Array.from({ length: 3 }, () => ({
				completed: true,
				prescribedMetric1: null,
				performedMetric1: 8,
				prescribedMetric2: null,
				performedMetric2: 300,
				hasMetric2: 1,
			})),
		];

		for (const set of sets) executeFormula(formula, adherence, set);

		expect(adherence.count).toBe(8);
		expect(adherence.completed).toBe(3);
		expect(evaluateValueFormula('(curr.completed / curr.count) * 100', adherence)).toBe(37.5);
	});

	it('rejects unsafe and malformed formulas', () => {
		expect(() => validateFormula('curr.__proto__ = 1', ['peso'], true)).toThrow();
		expect(() => validateFormula('process.exit', ['peso'], true)).toThrow();
		expect(() => validateFormula('curr.total = peso()', ['peso'], true)).toThrow();
		expect(() => validateFormula('curr.total = unknown', ['peso'], true)).toThrow();
	});
});
