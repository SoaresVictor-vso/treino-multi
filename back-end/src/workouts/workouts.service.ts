import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { WorkoutStatus } from '../common/enums/workout-status.enum';
import { Activity } from '../workout-templates/entities/activity.entity';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';

export interface GenerateWorkoutFromTemplateInput {
	template: WorkoutTemplate;
	athleteId: string;
	createdBy: string;
	scheduledDate?: string;
}

@Injectable()
export class WorkoutsService {
	constructor(private readonly dataSource: DataSource) {}

	async generateWorkoutFromTemplate(
		input: GenerateWorkoutFromTemplateInput,
	): Promise<Workout> {
		return this.dataSource.transaction(async (manager) => {
			const { template } = input;

			const scheduledDate = input.scheduledDate ?? undefined;
			const workout = await manager.save(
				Workout,
				manager.create(Workout, {
					tenantId: template.tenantId,
					athleteId: input.athleteId,
					workoutTemplateId: template.id,
					templateName: template.name,
					templateDescription: template.description,
					scheduledDate,
					performedAt: undefined,
					status: scheduledDate ? WorkoutStatus.SCHEDULED : WorkoutStatus.PENDING,
					createdBy: input.createdBy,
					updatedBy: input.createdBy,
				}),
			);

			if (template.activities.length) {
				await manager.save(
					Execution,
					template.activities.map((activity, index) =>
						this.createExecution(manager, workout.id, activity, index),
					),
				);
			}

			return workout;
		});
	}

	private createExecution(
		manager: EntityManager,
		workoutId: string,
		activity: Activity,
		index: number,
	) {
		return manager.create(Execution, {
			workoutId,
			exerciseId: activity.exerciseId,
			position: index + 1,
			prescribedMetric1: activity.metric1,
			prescribedMetric2: activity.metric2,
			prescribedPse: activity.pse,
			prescribedRestDuration: activity.restDuration,
			performedMetric1: null,
			performedMetric2: null,
			performedPse: null,
			performedRestDuration: null,
			performedNote: null,
			status: ExecutionStatus.PENDING,
			startedAt: null,
			finishedAt: null,
		});
	}

	private createExerciseNotes(
		manager: EntityManager,
		workoutId: string,
		activities: Activity[],
		userId: string,
	) {
		const notesByExercise = new Map<number, string>();
		for (const activity of activities) {
			if (activity.note && !notesByExercise.has(activity.exerciseId)) {
				notesByExercise.set(activity.exerciseId, activity.note);
			}
		}
		return [...notesByExercise].map(([exerciseId, note]) =>
			manager.create(WorkoutExerciseNote, {
				workoutId,
				exerciseId,
				note,
				createdBy: userId,
				updatedBy: userId,
			}),
		);
	}
}
