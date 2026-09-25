import { enums, tools, types } from '@treino-multi/shared';
const { ExecutionStatus } = enums;
type ExecutionStatus = enums.ExecutionStatus;
const { createZeroState, evaluateValueFormula, executeFormula, formulaFields, validateFormula } = tools;
type FormulaContext = types.FormulaContext;
import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { Execution } from '../workouts/entities/execution.entity';
import { Workout } from '../workouts/entities/workout.entity';
import { Metric } from '../metrics/entities/metric.entity';
import { Measurement } from './entities/measurement.entity';
import { WorkoutMeasurement } from './entities/workout-measurement.entity';



const executionFields = [
	'duration',
	'rpe',
	'prescribedRpe',
	'completed',
	'performedMetric1',
	'performedMetric2',
	'prescribedMetric1',
	'prescribedMetric2',
	'hasMetric2',
	'metricsMatch',
	'performedRestDuration',
	'prescribedRestDuration',
];
export type CalculatedMeasurement = {
	measurement: Measurement;
	value: number;
	score: number;
	compatibleExecutions: number;
	consideredSets: number;
};

@Injectable()
export class MeasurementsService {
	constructor(
		@InjectRepository(Measurement)
		private readonly measurements: Repository<Measurement>,
		@InjectRepository(WorkoutMeasurement)
		private readonly results: Repository<WorkoutMeasurement>,
		@InjectRepository(Metric) private readonly metrics: Repository<Metric>,
	) {}

	async validateMeasurement(
		input: Pick<Measurement, 'formula' | 'valueFormula'>,
	): Promise<void> {
		const metricNames = (await this.metrics.find()).map((item) => item.name);
		try {
			validateFormula(input.formula, [...executionFields, ...metricNames], true);
			validateFormula(input.valueFormula, [], false);
		} catch (error) {
			throw new BadRequestException(
				error instanceof Error ? error.message : 'Fórmula inválida.',
			);
		}
	}

	private context(
		execution: Execution & {
			exercise: { metric1: { name: string }; metric2: { name: string } | null };
		},
	): FormulaContext {
		const duration =
			execution.startedAt && execution.finishedAt
				? Math.max(
						0,
						(execution.finishedAt.getTime() - execution.startedAt.getTime()) / 1000,
					)
				: null;
		const values: FormulaContext = {
			duration,
			rpe: execution.performedPse,
			prescribedRpe: execution.prescribedPse,
			completed: execution.status === ExecutionStatus.COMPLETED,
			performedMetric1: execution.performedMetric1,
			performedMetric2: execution.performedMetric2,
			prescribedMetric1: execution.prescribedMetric1,
			prescribedMetric2: execution.prescribedMetric2,
			hasMetric2: execution.exercise.metric2 !== null,
			metricsMatch:
				execution.prescribedMetric1 !== null &&
				execution.prescribedMetric1 > 0 &&
				execution.performedMetric1 === execution.prescribedMetric1 &&
				(execution.exercise.metric2 === null ||
					(execution.prescribedMetric2 !== null &&
						execution.prescribedMetric2 > 0 &&
						execution.performedMetric2 === execution.prescribedMetric2)),
			performedRestDuration: execution.performedRestDuration,
			prescribedRestDuration: execution.prescribedRestDuration,
		};
		values[execution.exercise.metric1.name] = execution.performedMetric1;
		if (execution.exercise.metric2)
			values[execution.exercise.metric2.name] = execution.performedMetric2;
		return values;
	}

	private compatible(
		measurement: Measurement,
		execution: Execution & {
			exercise: {
				metric1: { id: number; name: string };
				metric2: { id: number; name: string } | null;
			};
		},
	) {
		// Workout adherence counts every completed set and prescribed skipped sets.
		// An unprescribed skipped set does not contribute to the denominator.
		if (measurement.key === 'workout-adherence') return true;

		// A prescribed, pending or skipped set has no training result and must not
		// participate in any aggregate metric (tonnage, adherence, pace, etc.).
		if (execution.status !== ExecutionStatus.COMPLETED) return false;
		const context = this.context(execution);
		const needs = [measurement.metric1, measurement.metric2].filter(
			(metric): metric is NonNullable<typeof metric> => !!metric,
		);
		if (
			!needs.every(
				(metric) =>
					Number.isFinite(Number(context[metric.name])) &&
					Number(context[metric.name]) > 0,
			)
		)
			return false;
		// The duration measurement is the workout interval, not the interval of an
		// individual set. A legacy/directly-completed set may not have startedAt.
		if (measurement.key === 'duration') return true;
		return formulaFields(measurement.formula).every((field) => {
			const value = context[field];
			return (
				field === 'completed' ||
				(Number.isFinite(Number(value)) && Number(value) > 0)
			);
		});
	}

	async calculateForWorkout(
		manager: EntityManager,
		workoutId: string,
	): Promise<CalculatedMeasurement[]> {
		const [measurements, executions, workout] = await Promise.all([
			manager.getRepository(Measurement).find({
				where: { active: true },
				relations: { metric1: true, metric2: true },
			}),
			manager.getRepository(Execution).find({
				where: { workoutId },
				relations: { exercise: { metric1: true, metric2: true } },
			}),
			manager.getRepository(Workout).findOneByOrFail({ id: workoutId }),
		]);
		const workoutDuration =
			workout.performedAt && workout.finishedAt
				? Math.max(
						0,
						(workout.finishedAt.getTime() - workout.performedAt.getTime()) / 1000,
					)
				: null;
		return measurements
			.flatMap((measurement) => {
				if (
					measurement.key === 'workout-adherence' &&
					workout.createdBy === workout.athleteId
				)
					return [];
				const compatible = executions.filter((execution) =>
					this.compatible(measurement, execution),
				);
				if (!compatible.length) return [];
				const curr = createZeroState();
				try {
					if (measurement.key === 'duration') {
						if (workoutDuration === null || !compatible[0]) return [];
						executeFormula(measurement.formula, curr, {
							...this.context(compatible[0]),
							duration: workoutDuration,
						});
					} else
						for (const execution of compatible)
							executeFormula(measurement.formula, curr, this.context(execution));
					const value = evaluateValueFormula(measurement.valueFormula, curr);
					const consideredSets = [
						'average-rpe',
					'effort-adherence',
					'workout-adherence',
				].includes(measurement.key)
						? Math.max(0, Number(curr.count) || 0)
						: compatible.length;
					return [
						{
							measurement,
							value,
							compatibleExecutions: compatible.length,
							consideredSets,
							score:
								Number(measurement.staticWeight) +
								compatible.length * Number(measurement.dynamicWeight),
						},
					];
				} catch {
					return [];
				}
			})
			.sort((left, right) => right.score - left.score);
	}

	async persistForWorkout(
		manager: EntityManager,
		workoutId: string,
	): Promise<void> {
		const calculated = await this.calculateForWorkout(manager, workoutId);
		await manager.getRepository(WorkoutMeasurement).delete({ workoutId });
		await manager.getRepository(WorkoutMeasurement).save(
			calculated.map(({ measurement, value, score, compatibleExecutions, consideredSets }) =>
				manager.create(WorkoutMeasurement, {
					workoutId,
					measurementId: measurement.id,
					value,
					score,
					consideredSets,
					snapshot: {
						key: measurement.key,
						name: measurement.name,
						icon: measurement.icon,
						presentation: measurement.presentation,
					},
				}),
			),
		);
	}

	async findForWorkout(workoutId: string) {
		return this.results
			.find({ where: { workoutId }, order: { score: 'DESC' } })
			.then((items) =>
				items.map((item) => ({
					id: item.id,
					measurementId: item.measurementId,
					value: Number(item.value),
					score: Number(item.score),
					...item.snapshot,
				})),
			);
	}
}
