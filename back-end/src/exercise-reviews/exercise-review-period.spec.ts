import { exerciseReviewPeriod } from './exercise-review-period';

describe('exercise review period', () => {
	it('returns the same rolling three-month window used by exercise charts and analysis', () => {
		expect(exerciseReviewPeriod(new Date('2026-09-22T12:00:00.000Z'))).toEqual({
			from: '2026-06-22T12:00:00.000Z',
			to: '2026-09-22T12:00:00.000Z',
		});
	});
});
