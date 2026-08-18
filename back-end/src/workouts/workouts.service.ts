import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { WorkoutStatus } from '../common/enums/workout-status.enum';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { UsersService } from '../users/users.service';
import { Activity } from '../workout-templates/entities/activity.entity';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { GenerateWorkoutsFromTemplateDto } from './dto/generate-workouts-from-template.dto';
import { UpdateWorkoutExecutionsDto } from './dto/update-workout-executions.dto';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';

export interface GenerateWorkoutFromTemplateInput {
	template: WorkoutTemplate;
	athleteId: string;
	createdBy: string;
	scheduledDate?: string;
}

type WorkoutExecutionRow = {
	workoutId: string;
	athleteId: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	workoutStatus: WorkoutStatus;
	canRead: boolean;
	executionId: string | number | null;
	exerciseId: string | number | null;
	position: string | number | null;
	prescribedMetric1: string | number | null;
	prescribedMetric2: string | number | null;
	metric1Type: 'v' | null;
	metric2Type: 'v' | 'p' | null;
	prescribedPse: string | number | null;
	prescribedRestDuration: string | number | null;
	performedMetric1: string | number | null;
	performedMetric2: string | number | null;
	performedPse: string | number | null;
	performedRestDuration: string | number | null;
	performedNote: string | null;
	executionStatus: ExecutionStatus | null;
	exerciseIdReference: string | number | null;
	exerciseName: string | null;
	exerciseDescription: string | null;
	metric1Id: string | number | null;
	metric1Name: string | null;
	metric1Symbol: string | null;
	metric1FieldType: string | null;
	metric2Id: string | number | null;
	metric2Name: string | null;
	metric2Symbol: string | null;
	metric2FieldType: string | null;
	referenceGroupId: string | number | null;
	referenceGroupName: string | null;
	recordId: string | null;
	recordValue: string | number | null;
	recordMeasuredAt: string | null;
};

function numberOrNull(value: string | number | null): number | null {
	return value === null ? null : Number(value);
}

@Injectable()
export class WorkoutsService {
	constructor(
		private readonly dataSource: DataSource,
		@InjectRepository(AthleteTrainerAssociation)
		private readonly associations: Repository<AthleteTrainerAssociation>,
		@InjectRepository(WorkoutTemplate)
		private readonly templates: Repository<WorkoutTemplate>,
		private readonly usersService: UsersService,
	) {}

	async findMyWorkouts(actor: JwtPayload) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		return this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere('workout.tenantId = :tenantId', { tenantId: actor.tenantId })
			.andWhere('workout.status IN (:...statuses)', {
				statuses: [
					WorkoutStatus.PENDING,
					WorkoutStatus.SCHEDULED,
					WorkoutStatus.IN_PROGRESS,
				],
			})
			.orderBy(
				'CASE WHEN workout.status = :inProgressStatus THEN 0 ELSE 1 END',
				'ASC',
			)
			.setParameter('inProgressStatus', WorkoutStatus.IN_PROGRESS)
			.addOrderBy('workout.scheduledDate', 'ASC', 'NULLS FIRST')
			.addOrderBy('workout.createdAt', 'DESC')
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'workout.status AS status',
			])
			.getRawMany();
	}

	async findMyCompletedWorkouts(actor: JwtPayload) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		return this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere('workout.tenantId = :tenantId', { tenantId: actor.tenantId })
			.andWhere('workout.status = :status', { status: WorkoutStatus.COMPLETED })
			.orderBy('workout.performedAt', 'DESC', 'NULLS LAST')
			.addOrderBy('workout.updatedAt', 'DESC')
			.take(5)
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'workout.performed_at AS "performedAt"',
				'workout.status AS status',
			])
			.getRawMany();
	}

	async findTrainerWorkouts(actor: JwtPayload) {
		const isTrainer = actor.roles.some((role) =>
			[Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER].includes(role),
		);
		if (!isTrainer)
			throw new ForbiddenException('Esta consulta é exclusiva para treinadores.');
		if (!actor.tenantId)
			throw new ForbiddenException('O treinador precisa estar vinculado a um tenant.');

		return this.dataSource.query<
			{
				id: string;
				athleteId: string;
				athleteName: string;
				templateName: string;
				templateDescription: string;
				scheduledDate: string | null;
				performedAt: string | null;
				status: WorkoutStatus;
			}[]
		>(
			`SELECT
				workout.id AS id,
				workout.athlete_id AS "athleteId",
				person.name AS "athleteName",
				workout.template_name AS "templateName",
				workout.template_description AS "templateDescription",
				workout.scheduled_date AS "scheduledDate",
				workout.performed_at AS "performedAt",
				workout.status AS status
			FROM workouts workout
			INNER JOIN athlete_trainer_associations association
				ON association.athlete_id = workout.athlete_id
				AND association.treinador_id = $1
				AND association.data_fim IS NULL
			INNER JOIN users athlete ON athlete.id = workout.athlete_id
			INNER JOIN persons person ON person.id = athlete.person_id
			WHERE workout.tenant_id = $2
				AND (
					workout.status IN ('pending', 'scheduled', 'in_progress')
					OR (
						workout.status = 'completed'
						AND workout.performed_at >= CURRENT_DATE - INTERVAL '7 days'
					)
				)
			ORDER BY
				CASE workout.status
					WHEN 'in_progress' THEN 0
					WHEN 'pending' THEN 1
					WHEN 'scheduled' THEN 2
					ELSE 3
				END,
				workout.performed_at DESC NULLS LAST,
				workout.scheduled_date ASC NULLS FIRST,
				person.name ASC`,
			[actor.sub, actor.tenantId],
		);
	}

	async findWorkout(id: string, actor: JwtPayload) {
		const isOrganizationStaff = actor.roles.some((role) =>
			[Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role),
		);
		const isTenantAdmin = actor.roles.includes(Role.TENANT_ADMIN);
		const isTrainer = actor.roles.some((role) =>
			[Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER].includes(role),
		);
		const rows = await this.dataSource.query<WorkoutExecutionRow[]>(
			`SELECT
				workout.id AS "workoutId",
				workout.athlete_id AS "athleteId",
				workout.template_name AS "templateName",
				workout.template_description AS "templateDescription",
				workout.scheduled_date AS "scheduledDate",
				workout.status AS "workoutStatus",
				(
					workout.athlete_id = $2
					OR $3::boolean
					OR ($4::boolean AND workout.tenant_id = $5)
					OR (
						$6::boolean
						AND EXISTS (
							SELECT 1
							FROM athlete_trainer_associations association
							WHERE association.athlete_id = workout.athlete_id
								AND association.treinador_id = $2
								AND association.data_fim IS NULL
						)
					)
				) AS "canRead",
				execution.id AS "executionId",
				execution.exercise_id AS "exerciseId",
				execution.position AS "position",
				execution.prescribed_metric_1 AS "prescribedMetric1",
				execution.prescribed_metric_2 AS "prescribedMetric2",
				execution.metric1_type AS "metric1Type",
				execution.metric2_type AS "metric2Type",
				execution.prescribed_pse AS "prescribedPse",
				execution.prescribed_rest_duration AS "prescribedRestDuration",
				execution.performed_metric_1 AS "performedMetric1",
				execution.performed_metric_2 AS "performedMetric2",
				execution.performed_pse AS "performedPse",
				execution.performed_rest_duration AS "performedRestDuration",
				execution.performed_note AS "performedNote",
				execution.status AS "executionStatus",
				exercise.id AS "exerciseIdReference",
				exercise.name AS "exerciseName",
				exercise.description AS "exerciseDescription",
				metric_1.id AS "metric1Id",
				metric_1.name AS "metric1Name",
				metric_1.symbol AS "metric1Symbol",
				metric_1.field_type AS "metric1FieldType",
				metric_2.id AS "metric2Id",
				metric_2.name AS "metric2Name",
				metric_2.symbol AS "metric2Symbol",
				metric_2.field_type AS "metric2FieldType",
				exercise_group.id AS "referenceGroupId",
				exercise_group.name AS "referenceGroupName",
				COALESCE(group_record.id, exercise_record.id) AS "recordId",
				COALESCE(group_record.value, exercise_record.value) AS "recordValue",
				COALESCE(group_record.measured_at, exercise_record.measured_at) AS "recordMeasuredAt"
			FROM workouts workout
			LEFT JOIN executions execution ON execution.workout_id = workout.id
			LEFT JOIN exercises exercise ON exercise.id = execution.exercise_id
			LEFT JOIN metrics metric_1 ON metric_1.id = exercise.metric_1_id
			LEFT JOIN metrics metric_2 ON metric_2.id = exercise.metric_2_id
			LEFT JOIN LATERAL (
				SELECT membership.exercise_group_id
				FROM exercise_group_exercises membership
				WHERE membership.exercise_id = execution.exercise_id
					AND membership.deleted_at IS NULL
				ORDER BY membership.id
				LIMIT 1
			) membership ON true
			LEFT JOIN exercise_groups exercise_group ON exercise_group.id = membership.exercise_group_id
				AND exercise_group.deleted_at IS NULL
			LEFT JOIN personal_records group_record ON group_record.athlete_id = workout.athlete_id
				AND group_record.exercise_group_id = exercise_group.id
				AND group_record.deleted_at IS NULL
			LEFT JOIN personal_records exercise_record ON exercise_record.athlete_id = workout.athlete_id
				AND exercise_record.exercise_id = execution.exercise_id
				AND exercise_record.exercise_group_id IS NULL
				AND exercise_record.deleted_at IS NULL
			WHERE workout.id = $1
			ORDER BY execution.position ASC`,
			[
				id,
				actor.sub,
				isOrganizationStaff,
				isTenantAdmin,
				actor.tenantId,
				isTrainer,
			],
		);
		if (!rows.length) throw new NotFoundException('Treino não encontrado.');
		if (!rows[0].canRead)
			throw new ForbiddenException('Você não pode visualizar este treino.');
		const workout = rows[0];
		return {
			id: workout.workoutId,
			athleteId: workout.athleteId,
			templateName: workout.templateName,
			templateDescription: workout.templateDescription,
			scheduledDate: workout.scheduledDate,
			status: workout.workoutStatus,
			executions: rows
				.filter((row) => row.executionId !== null)
				.map((execution) => ({
					id: Number(execution.executionId),
					exerciseId: Number(execution.exerciseId),
					position: Number(execution.position),
					prescribedMetric1: numberOrNull(execution.prescribedMetric1),
					prescribedMetric2:
						execution.metric2Type === 'p' &&
						execution.recordId !== null &&
						execution.prescribedMetric2 !== null
							? (Number(execution.prescribedMetric2) *
									Number(execution.recordValue)) /
								100
							: numberOrNull(execution.prescribedMetric2),
					metric1Type: execution.metric1Type,
					metric2Type:
						execution.metric2Type === 'p' && execution.recordId !== null
							? 'v'
							: execution.metric2Type,
					prescribedPse: numberOrNull(execution.prescribedPse),
					prescribedRestDuration: numberOrNull(execution.prescribedRestDuration),
					performedMetric1: numberOrNull(execution.performedMetric1),
					performedMetric2: numberOrNull(execution.performedMetric2),
					performedPse: numberOrNull(execution.performedPse),
					performedRestDuration: numberOrNull(execution.performedRestDuration),
					performedNote: execution.performedNote,
					status: execution.executionStatus,
					exercise: {
						id: Number(execution.exerciseIdReference),
						name: execution.exerciseName,
						description: execution.exerciseDescription,
						metric_1: {
							id: Number(execution.metric1Id),
							name: execution.metric1Name,
							symbol: execution.metric1Symbol,
							fieldType: execution.metric1FieldType,
						},
						...(execution.metric2Id === null
							? {}
							: {
									metric_2: {
										id: Number(execution.metric2Id),
										name: execution.metric2Name!,
										symbol: execution.metric2Symbol!,
										fieldType: execution.metric2FieldType!,
									},
								}),
					},
					referencePersonalRecord:
						execution.metric2Type === 'p' && execution.recordId
							? {
									id: execution.recordId,
									value: Number(execution.recordValue),
									measuredAt: execution.recordMeasuredAt!,
								}
							: null,
					referenceGroup:
						execution.referenceGroupId === null
							? null
							: {
									id: Number(execution.referenceGroupId),
									name: execution.referenceGroupName!,
								},
				})),
		};
	}

	async startWorkout(id: string, actor: JwtPayload) {
		const workout = await this.findWritableWorkout(id, actor);
		if (
			![WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED].includes(workout.status)
		)
			throw new BadRequestException('Este treino não pode mais ser iniciado.');
		await this.dataSource.transaction(async (manager) => {
			// Serializa inícios do mesmo atleta, inclusive quando são treinos distintos.
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
				workout.athleteId,
			]);
			const missingPersonalRecords = await manager.query(
				`SELECT 1
				FROM executions execution
				WHERE execution.workout_id = $1
					AND execution.metric2_type = 'p'
					AND NOT EXISTS (
						SELECT 1
						FROM personal_records record
						WHERE record.athlete_id = $2
							AND record.deleted_at IS NULL
							AND (
								record.exercise_id = execution.exercise_id
								OR record.exercise_group_id = (
									SELECT membership.exercise_group_id
									FROM exercise_group_exercises membership
									WHERE membership.exercise_id = execution.exercise_id
										AND membership.deleted_at IS NULL
									ORDER BY membership.id
									LIMIT 1
								)
							)
					)
					LIMIT 1`,
				[id, workout.athleteId],
			);
			if (missingPersonalRecords?.length)
				throw new BadRequestException(
					'Cadastre os RPs necessários antes de iniciar o treino.',
				);
			const hasWorkoutInProgress = await manager.getRepository(Workout).existsBy({
				athleteId: workout.athleteId,
				status: WorkoutStatus.IN_PROGRESS,
			});
			if (hasWorkoutInProgress)
				throw new BadRequestException(
					'Já existe um treino em andamento para este atleta.',
				);
			workout.status = WorkoutStatus.IN_PROGRESS;
			workout.performedAt = new Date();
			workout.updatedBy = actor.sub;
			await manager.save(workout);
			await manager
				.createQueryBuilder()
				.update(Execution)
				.set({ status: ExecutionStatus.IN_PROGRESS, startedAt: new Date() })
				.where('workout_id = :id AND status = :status', {
					id,
					status: ExecutionStatus.PENDING,
				})
				.execute();
		});
		return this.findWorkout(id, actor);
	}

	async updateExecutions(
		id: string,
		dto: UpdateWorkoutExecutionsDto,
		actor: JwtPayload,
	) {
		const workout = await this.findWritableWorkout(id, actor);
		if (workout.status !== WorkoutStatus.IN_PROGRESS)
			throw new BadRequestException('Inicie o treino antes de alterar as séries.');
		const positions = dto.executions.map((execution) => execution.position);
		if (new Set(positions).size !== positions.length)
			throw new BadRequestException('As posições das séries devem ser únicas.');
		await this.dataSource.transaction(async (manager) => {
			const current = await manager.find(Execution, { where: { workoutId: id } });
			const submittedIds = dto.executions
				.map((execution) => execution.id)
				.filter((executionId): executionId is number => executionId !== undefined);
			if (new Set(submittedIds).size !== submittedIds.length)
				throw new BadRequestException('Uma série só pode ser enviada uma vez.');
			const submittedIdSet = new Set(submittedIds);
			if (current.some((execution) => !submittedIdSet.has(execution.id)))
				throw new BadRequestException(
					'Todas as séries existentes devem ser enviadas para preservar a ordem.',
				);
			if (current.length) {
				const temporaryPositionOffset =
					Math.max(...current.map((execution) => execution.position)) +
					dto.executions.length +
					1;
				await manager
					.createQueryBuilder()
					.update(Execution)
					.set({ position: () => `position + ${temporaryPositionOffset}` })
					.where('workout_id = :id', { id })
					.execute();
			}
			const currentById = new Map(
				current.map((execution) => [execution.id, execution]),
			);
			for (const input of dto.executions) {
				const execution = input.id ? currentById.get(input.id) : null;
				if (input.id && !execution)
					throw new BadRequestException('Série não pertence a este treino.');
				const entity =
					execution ??
					manager.create(Execution, {
						workoutId: id,
						exerciseId: input.exerciseId,
						position: input.position,
						metric1Type: 'v',
						metric2Type: null,
						status: ExecutionStatus.IN_PROGRESS,
						startedAt: new Date(),
					});
				Object.assign(entity, input);
				if (
					entity.status === ExecutionStatus.COMPLETED ||
					entity.status === ExecutionStatus.SKIPPED
				)
					entity.finishedAt = new Date();
				await manager.save(entity);
			}
			workout.updatedBy = actor.sub;
			await manager.save(workout);
		});
		return this.findWorkout(id, actor);
	}

	async completeWorkout(id: string, actor: JwtPayload) {
		const workout = await this.findWritableWorkout(id, actor);
		if (workout.status !== WorkoutStatus.IN_PROGRESS)
			throw new BadRequestException('Este treino não está em andamento.');
		const unresolved = await this.dataSource.getRepository(Execution).count({
			where: {
				workoutId: id,
				status: In([ExecutionStatus.PENDING, ExecutionStatus.IN_PROGRESS]),
			},
		});
		if (unresolved)
			throw new BadRequestException(
				'Conclua ou pule todas as séries antes de finalizar o treino.',
			);
		workout.status = WorkoutStatus.COMPLETED;
		workout.updatedBy = actor.sub;
		await this.dataSource.getRepository(Workout).save(workout);
		return this.findWorkout(id, actor);
	}

	async generateWorkoutsFromTemplate(
		dto: GenerateWorkoutsFromTemplateDto,
		actor: JwtPayload,
	) {
		const athleteIds = [...new Set(dto.athleteIds)];
		const hasAthleteManagement = actor.roles.some((role) =>
			[Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(
				role,
			),
		);
		if (!hasAthleteManagement) {
			const associations = await this.associations.findBy({
				trainerId: actor.sub,
				athleteId: In(athleteIds),
				endDate: IsNull(),
			});
			if (associations.length !== athleteIds.length)
				throw new ForbiddenException(
					'Você só pode atribuir treinos aos seus atletas vinculados.',
				);
		}
		const [athletes, template] = await Promise.all([
			this.usersService.findTenantUser(athleteIds, actor.tenantId),
			this.templates.findOne({
				where: {
					id: dto.templateId,
					...(actor.tenantId && { tenantId: actor.tenantId }),
				},
				relations: ['activities'],
			}),
		]);
		if (
			athletes.some(
				(athlete) =>
					!athlete.userRoles.some(
						(role) => role.role === Role.TENANT_CLIENT && !role.deletedAt,
					),
			)
		)
			throw new BadRequestException(
				'Um dos usuários selecionados não é um atleta.',
			);
		if (!template)
			throw new NotFoundException('Template de treino não encontrado.');
		const workouts = await Promise.all(
			athletes.map((athlete) =>
				this.generateWorkoutFromTemplate({
					template,
					athleteId: athlete.id,
					createdBy: actor.sub,
					scheduledDate: dto.scheduledDate,
				}),
			),
		);
		return { count: workouts.length, workouts };
	}

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
					template.activities.map((activity) =>
						this.createExecution(manager, workout.id, activity),
					),
				);
				const notes = this.createExerciseNotes(
					manager,
					workout.id,
					template.activities,
					input.createdBy,
				);
				if (notes.length) await manager.save(WorkoutExerciseNote, notes);
			}

			return workout;
		});
	}

	private async findReadableWorkout(id: string, actor: JwtPayload) {
		const workout = await this.dataSource
			.getRepository(Workout)
			.findOne({ where: { id } });
		if (!workout) throw new NotFoundException('Treino não encontrado.');
		if (actor.sub === workout.athleteId) return workout;
		if (
			actor.roles.some((role) =>
				[Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role),
			) ||
			(actor.roles.includes(Role.TENANT_ADMIN) &&
				actor.tenantId === workout.tenantId)
		)
			return workout;
		if (
			actor.roles.some((role) =>
				[Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER].includes(role),
			) &&
			(await this.associations.existsBy({
				athleteId: workout.athleteId,
				trainerId: actor.sub,
				endDate: IsNull(),
			}))
		)
			return workout;
		throw new ForbiddenException('Você não pode visualizar este treino.');
	}

	private async findWritableWorkout(id: string, actor: JwtPayload) {
		const workout = await this.findReadableWorkout(id, actor);
		if (actor.sub !== workout.athleteId)
			throw new ForbiddenException(
				'Somente o atleta deste treino pode alterá-lo.',
			);
		return workout;
	}

	private createExecution(
		manager: EntityManager,
		workoutId: string,
		activity: Activity,
	) {
		return manager.create(Execution, {
			workoutId,
			exerciseId: activity.exerciseId,
			position: activity.position,
			prescribedMetric1: activity.metric1,
			prescribedMetric2: activity.metric2,
			metric1Type: activity.type1,
			metric2Type: activity.type2,
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
