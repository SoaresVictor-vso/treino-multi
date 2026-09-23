import { EntityManager, Repository } from 'typeorm';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { Execution } from '../workouts/entities/execution.entity';
import { Workout } from '../workouts/entities/workout.entity';
import { Metric } from '../metrics/entities/metric.entity';
import { Measurement } from './entities/measurement.entity';
import { WorkoutMeasurement } from './entities/workout-measurement.entity';
import { MEASUREMENT_DEFINITIONS } from './measurements.constants';
import { agacho3WorkoutFixture } from './fixtures/agacho-3.fixture';
import { MeasurementsService } from './measurements.service';

const workoutAdherenceDefinition = MEASUREMENT_DEFINITIONS.find(
	(item) => item.key === 'workout-adherence',
)!;

function set(overrides: Partial<Execution> = {}): Execution {
	return {
		status: ExecutionStatus.COMPLETED,
		exerciseId: 1,
		prescribedMetric1: 10,
		performedMetric1: 10,
		prescribedMetric2: null,
		performedMetric2: null,
		prescribedPse: null,
		performedPse: null,
		startedAt: null,
		finishedAt: null,
		exercise: { metric1: { name: 'repeticoes' }, metric2: null },
		...overrides,
	} as Execution;
}

describe('workout adherence measurement', () => {
	const measurement = {
		...workoutAdherenceDefinition,
		metric1: null,
		metric2: null,
		active: true,
	} as Measurement;
	const service = new MeasurementsService(
		{} as Repository<Measurement>,
		{} as Repository<WorkoutMeasurement>,
		{} as Repository<Metric>,
	);

	function manager(createdBy: string) {
		const executions = [
			set(),
			set({ performedMetric1: 9 }),
			set({ status: ExecutionStatus.SKIPPED, performedMetric1: null }),
		];
		const workout = {
			athleteId: 'athlete',
			createdBy,
			performedAt: null,
			finishedAt: null,
		} as Workout;
		return {
			getRepository: (entity: unknown) => {
				if (entity === Measurement)
					return { find: () => Promise.resolve([measurement]) };
				if (entity === Execution)
					return { find: () => Promise.resolve(executions) };
				return { findOneByOrFail: () => Promise.resolve(workout) };
			},
		} as EntityManager;
	}

	it('scores matching, mismatched and skipped sets of a trainer-assigned workout', async () => {
		const result = await service.calculateForWorkout(
			manager('trainer'),
			'workout',
		);
		expect(result).toHaveLength(1);
		expect(result[0].compatibleExecutions).toBe(3);
		expect(result[0].value).toBe(50);
	});

	it('does not calculate adherence for a workout created by the athlete', async () => {
		expect(
			await service.calculateForWorkout(manager('athlete'), 'workout'),
		).toEqual([]);
	});

	it('calculates adherence from the Agacho 3 workout data', async () => {
		const definition = MEASUREMENT_DEFINITIONS.find(
			(item) => item.key === 'workout-adherence',
		)!;
		const seededMeasurement = {
			...definition,
			metric1: null,
			metric2: null,
			active: true,
		} as unknown as Measurement;
		const fixtureManager = {
			getRepository: (entity: unknown) => {
				if (entity === Measurement)
					return { find: () => Promise.resolve([seededMeasurement]) };
				if (entity === Execution)
					return {
						find: () => Promise.resolve(agacho3WorkoutFixture.executions),
					};
				return {
					findOneByOrFail: () =>
						Promise.resolve({
							athleteId: agacho3WorkoutFixture.athleteId,
							createdBy: agacho3WorkoutFixture.createdBy,
							performedAt: agacho3WorkoutFixture.performedAt,
							finishedAt: agacho3WorkoutFixture.finishedAt,
						}),
				};
			},
		} as unknown as EntityManager;

		const results = await service.calculateForWorkout(
			fixtureManager,
			agacho3WorkoutFixture.id,
		);
		const adherence = results.find(
			(result) => result.measurement.key === 'workout-adherence',
		);
		expect(adherence).toBeDefined();
		expect(adherence?.compatibleExecutions).toBe(10);
		expect(adherence?.value).toBe(30);
	});
});
