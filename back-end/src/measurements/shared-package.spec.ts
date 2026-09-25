import { tools, constants, tests } from '@treino-multi/shared';
const { calculatePredictedRm, createZeroState, executeFormula, evaluateValueFormula } = tools;
const { MEASUREMENT_DEFINITIONS } = constants;
const { rmReferenceCases, formulaReferenceCases } = tests;





describe('shared package integration', () => {
  it('uses shared RM cases', () => {
    for (const item of rmReferenceCases) {
      const actual = calculatePredictedRm(item.weight, item.repetitions);
      if (item.expected === null) expect(actual).toBeNull();
      else expect(actual).toBeCloseTo(item.expected);
    }
  });
  it('uses shared measurement formula cases', () => {
    for (const item of formulaReferenceCases) {
      const definition = MEASUREMENT_DEFINITIONS.find((entry) => entry.key === item.key)!;
      const curr = createZeroState();
      for (const context of item.contexts) executeFormula(definition.formula, curr, context);
      expect(evaluateValueFormula(definition.valueFormula, curr)).toBeCloseTo(item.expected);
    }
  });
});
