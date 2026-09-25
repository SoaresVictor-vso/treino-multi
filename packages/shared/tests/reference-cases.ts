/** Shared regression inputs for both consumers. */
export const rmReferenceCases = [
  { weight: 100, repetitions: 1, expected: 100 },
  { weight: 100, repetitions: 10, expected: 133.33333333333334 },
  { weight: 100, repetitions: 36, expected: 3600 },
  { weight: 100, repetitions: 37, expected: null },
  { weight: null, repetitions: 10, expected: null },
] as const;

export const formulaReferenceCases = [
  { key: 'tonnage', contexts: [{ peso: 100, repeticoes: 5 }, { peso: 80, repeticoes: 8 }], expected: 1140 },
  { key: 'average-pace', contexts: [{ distancia: 1000, tempo: 300 }, { distancia: 2000, tempo: 660 }], expected: 0.32 },
] as const;
