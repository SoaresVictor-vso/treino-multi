const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tools, constants, tests } = require('@treino-multi/shared');
const { calculatePredictedRm, createZeroState, executeFormula, evaluateValueFormula } = tools;
const { MEASUREMENT_DEFINITIONS } = constants;
const { rmReferenceCases, formulaReferenceCases } = tests;

test('frontend resolves shared RM reference cases', () => {
  for (const { weight, repetitions, expected } of rmReferenceCases) {
    const actual = calculatePredictedRm(weight, repetitions);
    if (expected === null) assert.equal(actual, null);
    else assert.ok(Math.abs(actual - expected) < 0.0001);
  }
});

test('frontend resolves shared measurement formulas', () => {
  for (const { key, contexts, expected } of formulaReferenceCases) {
    const definition = MEASUREMENT_DEFINITIONS.find((item) => item.key === key);
    const curr = createZeroState();
    for (const context of contexts) executeFormula(definition.formula, curr, context);
    assert.ok(Math.abs(evaluateValueFormula(definition.valueFormula, curr) - expected) < 0.0001);
  }
});
