import { enums, tools } from '@treino-multi/shared';
const { Role, ExecutionStatus, ExecutionSetType, WorkoutStatus, AthleteTenantStatus } = enums;
type Role = enums.Role;
type ExecutionStatus = enums.ExecutionStatus;
type ExecutionSetType = enums.ExecutionSetType;
type WorkoutStatus = enums.WorkoutStatus;
type AthleteTenantStatus = enums.AthleteTenantStatus;
const { predictedRmForExecution } = tools;
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import {
	Brackets,
	DataSource,
	EntityManager,
	In,
	IsNull,
	Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';




import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { AthleteTenantAssociation } from '../athlete/entities/athlete-tenant-association.entity';

import { UsersService } from '../users/users.service';
import { Activity } from '../workout-templates/entities/activity.entity';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { GenerateWorkoutsFromTemplateDto } from './dto/generate-workouts-from-template.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutExecutionsDto } from './dto/update-workout-executions.dto';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { MeasurementsService } from '../measurements/measurements.service';
import { Exercise } from '../exercises/entities/exercise.entity';


export interface GenerateWorkoutFromTemplateInput {
	template: WorkoutTemplate;
	athleteId: string;
	createdBy: string;
	scheduledDate?: string;
}

type WorkoutExecutionRow = {
	workoutId: string;
	athleteId: string;
	createdBy: string;
	templateName: string;
	templateDescription: string;
	scheduledDate: string | null;
	performedAt: string | null;
	workoutFinishedAt: string | null;
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
	predictedRm: string | number | null;
	performedPse: string | number | null;
	performedRestDuration: string | number | null;
	performedNote: string | null;
	setType: ExecutionSetType;
	finishedAt: string | null;
	note: string | null;
	athleteNote: string | null;
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
	measurementResultId: string | null;
	measurementId: string | null;
	measurementValue: string | number | null;
	measurementScore: string | number | null;
	measurementKey: string | null;
	measurementName: string | null;
	measurementIcon: string | null;
	measurementPresentation: WorkoutMeasurementPresentation | null;
};

type WorkoutMeasurementPresentation = {
	containerClass: string;
	iconClass: string;
	valueClass: string;
	labelClass: string;
};

type WorkoutActivityInput = {
	exerciseId: number;
	position: number;
	metric1?: number | null;
	metric2?: number | null;
	type1: 'v';
	type2?: 'p' | 'v' | null;
	pse?: number | null;
	setType?: ExecutionSetType;
	restDuration?: number | null;
	note?: string | null;
};

type CompletedWorkoutCursor = {
	sortAt: string;
	id: string;
};

type AgendaWorkoutCursor = {
	scheduledDate: string | null;
	id: string;
};

const WORKOUTS_PAGE_SIZE = 5;

function encodeCompletedWorkoutCursor(cursor: CompletedWorkoutCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCompletedWorkoutCursor(value: string): CompletedWorkoutCursor {
	try {
		const cursor = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8'),
		) as Partial<CompletedWorkoutCursor>;
		if (typeof cursor.id !== 'string' || typeof cursor.sortAt !== 'string')
			throw new Error('Invalid cursor');
		return { id: cursor.id, sortAt: cursor.sortAt };
	} catch {
		throw new BadRequestException('Cursor de histórico inválido.');
	}
}

function encodeAgendaWorkoutCursor(cursor: AgendaWorkoutCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeAgendaWorkoutCursor(value: string): AgendaWorkoutCursor {
	try {
		const cursor = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8'),
		) as Partial<AgendaWorkoutCursor>;
		if (
			typeof cursor.id !== 'string' ||
			(cursor.scheduledDate !== null && typeof cursor.scheduledDate !== 'string')
		)
			throw new Error('Invalid cursor');
		return { id: cursor.id, scheduledDate: cursor.scheduledDate };
	} catch {
		throw new BadRequestException('Cursor da agenda inválido.');
	}
}

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
		private readonly measurementsService: MeasurementsService,
	) {}

	async findMyWorkouts(actor: JwtPayload) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		return this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
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

	async findMyAgendaWorkouts(actor: JwtPayload, cursorValue?: string) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		const cursor = cursorValue
			? decodeAgendaWorkoutCursor(cursorValue)
			: undefined;
		const rows = await this.dataSource.query<
			{
				workouts: {
					id: string;
					templateName: string;
					templateDescription: string;
					scheduledDate: string | null;
					status: enums.WorkoutStatus.PENDING | enums.WorkoutStatus.SCHEDULED;
				}[];
				total: string;
				inProgress: {
					id: string;
					templateName: string;
					templateDescription: string;
					scheduledDate: string | null;
					status: enums.WorkoutStatus.IN_PROGRESS;
				} | null;
			}[]
		>(
			`WITH matched AS (
				SELECT
					workout.id,
					workout.template_name AS "templateName",
					workout.template_description AS "templateDescription",
					workout.scheduled_date AS "scheduledDate",
					workout.status,
					COUNT(*) FILTER (WHERE workout.status IN ('pending', 'scheduled')) OVER() AS total
				FROM workouts workout
				WHERE workout.athlete_id = $1
					AND workout.status IN ('pending', 'scheduled', 'in_progress')
			), page AS (
				SELECT * FROM matched
				WHERE status IN ('pending', 'scheduled')
					AND (
						($3::date IS NULL AND $4::uuid IS NULL)
						OR ($3::date IS NULL AND $4::uuid IS NOT NULL AND "scheduledDate" IS NULL AND id > $4::uuid)
						OR ($3::date IS NOT NULL AND (
							"scheduledDate" > $3::date
							OR ("scheduledDate" = $3::date AND id > $4::uuid)
							OR "scheduledDate" IS NULL
						))
					)
				ORDER BY "scheduledDate" ASC NULLS LAST, id ASC
				LIMIT $5
			)
			SELECT
				COALESCE(json_agg(json_build_object(
					'id', page.id,
					'templateName', page."templateName",
					'templateDescription', page."templateDescription",
					'scheduledDate', page."scheduledDate",
					'status', page.status
				) ORDER BY page."scheduledDate" ASC NULLS LAST, page.id ASC), '[]'::json) AS workouts,
				COALESCE(MAX(page.total), 0) AS total,
				(SELECT json_build_object(
					'id', matched.id,
					'templateName', matched."templateName",
					'templateDescription', matched."templateDescription",
					'scheduledDate', matched."scheduledDate",
					'status', matched.status
				) FROM matched WHERE matched.status = 'in_progress' LIMIT 1) AS "inProgress"
			FROM page`,
			[
				actor.sub,
				actor.tenantId,
				cursor?.scheduledDate ?? null,
				cursor?.id ?? null,
				WORKOUTS_PAGE_SIZE + 1,
			],
		);
		const row = rows[0];
		const page = row?.workouts ?? [];
		const workouts = page.slice(0, WORKOUTS_PAGE_SIZE);
		const lastWorkout = workouts.at(-1);

		return {
			workouts,
			total: Number(row?.total ?? 0),
			inProgress: row?.inProgress ?? null,
			nextCursor:
				page.length > WORKOUTS_PAGE_SIZE && lastWorkout
					? encodeAgendaWorkoutCursor({
							id: lastWorkout.id,
							scheduledDate: lastWorkout.scheduledDate,
						})
					: null,
		};
	}

	async findMyCompletedWorkouts(actor: JwtPayload, cursorValue?: string) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		const cursor = cursorValue
			? decodeCompletedWorkoutCursor(cursorValue)
			: undefined;
		const baseQuery = this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere('workout.status = :status', { status: enums.WorkoutStatus.COMPLETED })
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'COALESCE(workout.performed_at, workout.updated_at) AS "performedAt"',
				'COALESCE(workout.performed_at, workout.updated_at) AS "sortAt"',
				'workout.status AS status',
				'COUNT(*) OVER() AS total',
			]);
		const query = this.dataSource
			.createQueryBuilder()
			.select('*')
			.from(`(${baseQuery.getQuery()})`, 'workout')
			.setParameters(baseQuery.getParameters());

		if (cursor) {
			query.andWhere(
				new Brackets((where) =>
					where
						.where('workout."sortAt" < :cursorSortAt', {
							cursorSortAt: cursor.sortAt,
						})
						.orWhere('workout."sortAt" = :cursorSortAt AND workout.id < :cursorId', {
							cursorSortAt: cursor.sortAt,
							cursorId: cursor.id,
						}),
				),
			);
		}

		const rows = await query
			.orderBy('workout."sortAt"', 'DESC')
			.addOrderBy('workout.id', 'DESC')
			.take(WORKOUTS_PAGE_SIZE + 1)
			.getRawMany<{
				id: string;
				templateName: string;
				templateDescription: string;
				scheduledDate: string | null;
				performedAt: string | null;
				sortAt: string;
				status: enums.WorkoutStatus.COMPLETED;
				total: string;
			}>();
		const total = Number(rows[0]?.total ?? 0);
		const workouts = rows
			.slice(0, WORKOUTS_PAGE_SIZE)
			.map(({ total: _, sortAt: __, ...workout }) => workout);
		const lastWorkout = workouts.at(-1);

		return {
			workouts,
			total,
			nextCursor:
				rows.length > WORKOUTS_PAGE_SIZE && lastWorkout
					? encodeCompletedWorkoutCursor({
							id: lastWorkout.id,
							sortAt: rows[WORKOUTS_PAGE_SIZE - 1].sortAt,
						})
					: null,
		};
	}

	async findMyCompletedWorkoutsForCalendar(
		actor: JwtPayload,
		period: 'week' | 'month',
		date?: string,
	) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');

		const referenceDate = date ?? new Date().toISOString().slice(0, 10);
		const intervalStart =
			period === 'week'
				? "date_trunc('week', :referenceDate::date)"
				: "date_trunc('month', :referenceDate::date)";
		const intervalEnd =
			period === 'week'
				? "date_trunc('week', :referenceDate::date) + interval '1 week'"
				: "date_trunc('month', :referenceDate::date) + interval '1 month'";

		const workouts = await this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere('workout.status = :status', { status: enums.WorkoutStatus.COMPLETED })
			.andWhere(
				`COALESCE(workout.performed_at, workout.updated_at) >= ${intervalStart}`,
			)
			.andWhere(
				`COALESCE(workout.performed_at, workout.updated_at) < ${intervalEnd}`,
			)
			.setParameter('referenceDate', referenceDate)
			.orderBy('COALESCE(workout.performed_at, workout.updated_at)', 'ASC')
			.addOrderBy('workout.id', 'ASC')
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'COALESCE(workout.performed_at, workout.updated_at) AS "performedAt"',
				'workout.status AS status',
			])
			.getRawMany();

		return { period, referenceDate, workouts };
	}

	async findMyWorkoutsForCalendar(
		actor: JwtPayload,
		date?: string,
		timeZone = 'UTC',
	) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');
		const referenceDate = date ?? new Date().toISOString().slice(0, 10);
		const referenceMonth = referenceDate.slice(0, 7);
		const isValidTimeZone = (() => {
			try {
				Intl.DateTimeFormat('en-US', { timeZone });
				return true;
			} catch {
				return false;
			}
		})();
		if (!isValidTimeZone) throw new BadRequestException('Fuso horário inválido.');

		const workouts = await this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere(
				new Brackets((where) =>
					where
						.where(
							`workout.status IN (:...scheduledStatuses) AND to_char(workout.scheduled_date, 'YYYY-MM') = :referenceMonth`,
							{
								scheduledStatuses: [
									WorkoutStatus.PENDING,
									WorkoutStatus.SCHEDULED,
									WorkoutStatus.SKIPPED,
								],
								referenceMonth,
							},
						)
						.orWhere(
							`workout.status IN (:...performedStatuses) AND to_char(COALESCE(workout.performed_at AT TIME ZONE :timeZone, workout.updated_at AT TIME ZONE :timeZone, workout.scheduled_date::timestamp), 'YYYY-MM') = :referenceMonth`,
							{
								performedStatuses: [WorkoutStatus.COMPLETED, WorkoutStatus.CANCELLED],
								timeZone,
								referenceMonth,
							},
						)
						.orWhere(
							`workout.status = :inProgressStatus AND to_char(NOW() AT TIME ZONE :timeZone, 'YYYY-MM') = :referenceMonth`,
							{
								inProgressStatus: WorkoutStatus.IN_PROGRESS,
								timeZone,
								referenceMonth,
							},
						)
						.orWhere(
							'workout.status IN (:...unscheduledStatuses) AND workout.scheduled_date IS NULL',
							{
								unscheduledStatuses: [WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED],
							},
						),
				),
			)
			.orderBy(
				`CASE WHEN workout.status IN ('completed', 'cancelled') THEN COALESCE(workout.performed_at AT TIME ZONE :timeZone, workout.updated_at AT TIME ZONE :timeZone, workout.scheduled_date::timestamp) ELSE workout.scheduled_date::timestamp END`,
				'ASC',
				'NULLS LAST',
			)
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'COALESCE(workout.performed_at, workout.updated_at) AS "performedAt"',
				'workout.status AS status',
			])
			.getRawMany();

		return { referenceDate, workouts };
	}

	async findTrainerWorkouts(actor: JwtPayload) {
		const isTrainerOrAdmin = actor.roles.some((role) =>
			[
				Role.TENANT_ADMIN,
				Role.TENANT_TRAINER,
				Role.TENANT_TRAINER_MASTER,
			].includes(role),
		);
		const canViewAllAthletes = actor.roles.some((role) =>
			[Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role),
		);
		if (!isTrainerOrAdmin)
			throw new ForbiddenException(
				'Esta consulta é exclusiva para administradores e treinadores.',
			);
		if (!actor.tenantId)
			throw new ForbiddenException(
				'O usuário precisa estar vinculado a um tenant.',
			);

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
				workout.finished_at AS "workoutFinishedAt",
				workout.performed_at AS "performedAt",
				workout.status AS status
			FROM workouts workout
			LEFT JOIN athlete_trainer_associations association
				ON association.athlete_id = workout.athlete_id
				AND association.treinador_id = $1
				AND association.data_fim IS NULL
			INNER JOIN users athlete ON athlete.id = workout.athlete_id
			INNER JOIN persons person ON person.id = athlete.person_id
			WHERE can_read_athlete_workout(workout.id, $1)
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
			[actor.sub],
		);
	}

	async findWorkout(id: string, actor: JwtPayload) {
		const rows = await this.dataSource.query<WorkoutExecutionRow[]>(
			`SELECT
				workout.id AS "workoutId",
				workout.athlete_id AS "athleteId",
				workout.created_by AS "createdBy",
				workout.template_name AS "templateName",
				workout.template_description AS "templateDescription",
				workout.scheduled_date AS "scheduledDate",
				workout.performed_at AS "performedAt",
				workout.finished_at AS "workoutFinishedAt",
				workout.status AS "workoutStatus",
				can_read_athlete_workout(workout.id, $2) AS "canRead",
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
				execution.predicted_rm AS "predictedRm",
				execution.performed_pse AS "performedPse",
				execution.performed_rest_duration AS "performedRestDuration",
				execution.performed_note AS "performedNote",
				execution.set_type AS "setType",
				execution.finished_at AS "finishedAt",
				workout_exercise_note.note AS "note",
				workout_exercise_note.athlete_note AS "athleteNote",
				execution.status AS "executionStatus",
				workout_measurement.id AS "measurementResultId",
				workout_measurement.measurement_id AS "measurementId",
				workout_measurement.value AS "measurementValue",
				workout_measurement.score AS "measurementScore",
				workout_measurement.snapshot->>'key' AS "measurementKey",
				workout_measurement.snapshot->>'name' AS "measurementName",
				workout_measurement.snapshot->>'icon' AS "measurementIcon",
				workout_measurement.snapshot->'presentation' AS "measurementPresentation",
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
			LEFT JOIN workout_exercise_notes workout_exercise_note
				ON workout_exercise_note.workout_id = workout.id
				AND workout_exercise_note.exercise_id = execution.exercise_id
			LEFT JOIN workout_measurements workout_measurement
				ON workout_measurement.workout_id = workout.id
			LEFT JOIN exercises exercise ON exercise.id = execution.exercise_id
			LEFT JOIN metrics metric_1 ON metric_1.id = exercise.metric_1_id
			LEFT JOIN metrics metric_2 ON metric_2.id = exercise.metric_2_id
			LEFT JOIN LATERAL (
				SELECT membership.exercise_group_id
				FROM exercise_group_exercises membership
				WHERE membership.exercise_id = execution.exercise_id
					AND membership.deleted_at IS NULL
					AND EXISTS (
						SELECT 1
						FROM exercise_groups exercise_group
						WHERE exercise_group.id = membership.exercise_group_id
							AND exercise_group.tenant_id = workout.tenant_id
							AND exercise_group.deleted_at IS NULL
					)
				ORDER BY membership.id
				LIMIT 1
			) membership ON true
			LEFT JOIN exercise_groups exercise_group ON exercise_group.id = membership.exercise_group_id
				AND exercise_group.deleted_at IS NULL
			LEFT JOIN LATERAL (
				SELECT record.*
				FROM personal_records record
				WHERE record.athlete_id = workout.athlete_id
					AND record.deleted_at IS NULL
					AND can_read_personal_record(record.id, $2)
					AND record.exercise_group_id IN (
						SELECT membership.exercise_group_id
						FROM exercise_group_exercises membership
						WHERE membership.exercise_id = execution.exercise_id
							AND membership.deleted_at IS NULL
							AND EXISTS (
								SELECT 1
								FROM exercise_groups exercise_group
								WHERE exercise_group.id = membership.exercise_group_id
									AND exercise_group.tenant_id = workout.tenant_id
									AND exercise_group.deleted_at IS NULL
							)
					)
				ORDER BY record.measured_at DESC, record.updated_at DESC
				LIMIT 1
			) group_record ON TRUE
			LEFT JOIN personal_records exercise_record ON exercise_record.athlete_id = workout.athlete_id
				AND exercise_record.exercise_id = execution.exercise_id
				AND exercise_record.exercise_group_id IS NULL
				AND exercise_record.deleted_at IS NULL
				AND can_read_personal_record(exercise_record.id, $2)
			WHERE workout.id = $1
			ORDER BY execution.position ASC`,
			[id, actor.sub],
		);
		if (!rows.length) throw new NotFoundException('Treino não encontrado.');
		if (!rows[0].canRead)
			throw new ForbiddenException('Você não pode visualizar este treino.');
		const workout = rows[0];
		let measurements = Array.from(
			new Map(
				rows
					.filter(
						(row) =>
							workout.workoutStatus === WorkoutStatus.COMPLETED &&
							row.measurementResultId !== null,
					)
					.map((row) => [
						row.measurementResultId!,
						{
							id: row.measurementResultId!,
							measurementId: row.measurementId!,
							value: Number(row.measurementValue),
							score: Number(row.measurementScore),
							key: row.measurementKey!,
							name: row.measurementName!,
							icon: row.measurementIcon!,
							presentation: row.measurementPresentation!,
						},
					]),
			).values(),
		);
		if (workout.workoutStatus === WorkoutStatus.COMPLETED && !measurements.length) {
			await this.dataSource.transaction(async (manager) => {
				// Evita que duas revisões abertas simultaneamente gerem o mesmo snapshot.
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
				if (!(await this.measurementsService.findForWorkout(id)).length)
					await this.measurementsService.persistForWorkout(manager, id);
			});
			measurements = await this.measurementsService.findForWorkout(id);
		}
		return {
			id: workout.workoutId,
			athleteId: workout.athleteId,
			createdBy: workout.createdBy,
			templateName: workout.templateName,
			templateDescription: workout.templateDescription,
			scheduledDate: workout.scheduledDate,
			performedAt: workout.performedAt,
			finishedAt: workout.workoutFinishedAt,
			status: workout.workoutStatus,
			measurements,
			executions: Array.from(
				new Map(
					rows
						.filter((row) => row.executionId !== null)
						.map((row) => [row.executionId!, row]),
				).values(),
			).map((execution) => ({
				id: Number(execution.executionId),
				exerciseId: Number(execution.exerciseId),
				position: Number(execution.position),
				prescribedMetric1: numberOrNull(execution.prescribedMetric1),
				prescribedMetric2:
					execution.metric2Type === 'p' &&
					execution.recordId !== null &&
					execution.prescribedMetric2 !== null
						? (Number(execution.prescribedMetric2) * Number(execution.recordValue)) /
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
				predictedRm: numberOrNull(execution.predictedRm),
				performedPse: numberOrNull(execution.performedPse),
				performedRestDuration: numberOrNull(execution.performedRestDuration),
				performedNote: execution.performedNote,
				setType: execution.setType,
				finishedAt: execution.finishedAt,
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
			exerciseNotes: Array.from(
				new Map(
					rows
						.filter((row) => row.exerciseId !== null && (row.note || row.athleteNote))
						.map((row) => [
							Number(row.exerciseId),
							{
								exerciseId: Number(row.exerciseId),
								note: row.note,
								athleteNote: row.athleteNote,
							},
						]),
				).values(),
			),
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
			const missingPersonalRecords: { name: string }[] = await manager.query(
				`SELECT DISTINCT exercise.name AS name
				FROM executions execution
				INNER JOIN exercises exercise ON exercise.id = execution.exercise_id
				WHERE execution.workout_id = $1
					AND execution.metric2_type = 'p'
					AND NOT EXISTS (
						SELECT 1
						FROM personal_records record
						WHERE record.athlete_id = $2
							AND record.deleted_at IS NULL
							AND (
								record.exercise_id = execution.exercise_id
								OR record.exercise_group_id IN (
									SELECT membership.exercise_group_id
									FROM exercise_group_exercises membership
									WHERE membership.exercise_id = execution.exercise_id
										AND membership.deleted_at IS NULL
										AND EXISTS (
											SELECT 1
											FROM exercise_groups exercise_group
											WHERE exercise_group.id = membership.exercise_group_id
												AND exercise_group.tenant_id = $3
												AND exercise_group.deleted_at IS NULL
										)
								)
							)
					)
				ORDER BY name`,
				[id, workout.athleteId, workout.tenantId],
			);
			if (missingPersonalRecords?.length)
				throw new BadRequestException(
					`Cadastre os RPs necessários antes de iniciar o treino: ${missingPersonalRecords.map((record) => record.name).join(', ')}.`,
				);
			const hasWorkoutInProgress = await manager.getRepository(Workout).existsBy({
				athleteId: workout.athleteId,
				status: enums.WorkoutStatus.IN_PROGRESS,
			});
			if (hasWorkoutInProgress)
				throw new BadRequestException(
					'Já existe um treino em andamento para este atleta.',
				);
			workout.status = WorkoutStatus.IN_PROGRESS;
			workout.performedAt = new Date();
			workout.updatedBy = actor.sub;
			await manager.save(workout);
			await this.startPendingExecutions(manager, id, workout.performedAt);
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
			const deletedIds = dto.deletedExecutionIds ?? [];
			if (new Set(deletedIds).size !== deletedIds.length)
				throw new BadRequestException('Uma série só pode ser removida uma vez.');
			const currentIdSet = new Set(current.map((execution) => execution.id));
			if (deletedIds.some((executionId) => !currentIdSet.has(executionId)))
				throw new BadRequestException('Série removida não pertence a este treino.');
			const activeCurrent = current.filter(
				(execution) => !deletedIds.includes(execution.id),
			);
			const submittedIds = dto.executions
				.map((execution) => execution.id)
				.filter((executionId): executionId is number => executionId !== undefined);
			if (new Set(submittedIds).size !== submittedIds.length)
				throw new BadRequestException('Uma série só pode ser enviada uma vez.');
			const submittedIdSet = new Set(submittedIds);
			if (activeCurrent.some((execution) => !submittedIdSet.has(execution.id)))
				throw new ConflictException({
					message:
						'Todas as séries existentes devem ser enviadas para preservar a ordem.',
					currentState: await this.findWorkout(id, actor),
				});
			if (deletedIds.length)
				await manager.delete(Execution, { workoutId: id, id: In(deletedIds) });
			if (activeCurrent.length) {
				const temporaryPositionOffset =
					Math.max(...activeCurrent.map((execution) => execution.position)) +
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
				activeCurrent.map((execution) => [execution.id, execution]),
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
						status: ExecutionStatus.PENDING,
						startedAt: null,
					});
				const previousStatus = entity.status;
				Object.assign(entity, input);
				if (
					entity.status === ExecutionStatus.COMPLETED &&
					(entity.performedPse === null || entity.performedPse === undefined)
				)
					entity.performedPse = entity.prescribedPse;
				if (
					entity.status === ExecutionStatus.COMPLETED ||
					entity.status === ExecutionStatus.SKIPPED
				) {
					if (!entity.startedAt) {
						const previous = current
							.filter((item) => item.position < entity.position && item.finishedAt)
							.toSorted((left, right) => right.position - left.position)[0];
						entity.startedAt = previous?.finishedAt ?? workout.performedAt ?? new Date();
					}
					if (previousStatus !== entity.status || !entity.finishedAt)
						entity.finishedAt = new Date();
				} else if (entity.status === ExecutionStatus.IN_PROGRESS)
					entity.finishedAt = null;
				const exercise = await manager.findOne(Exercise, {
					where: { id: entity.exerciseId },
					relations: { metric1: true, metric2: true },
				});
				if (!exercise) throw new BadRequestException('Exercício não encontrado.');
				entity.predictedRm = predictedRmForExecution({
					metric1Name: exercise.metric1.name,
					metric2Name: exercise.metric2?.name,
					metric1: entity.performedMetric1,
					metric2: entity.performedMetric2,
					completed: entity.status === ExecutionStatus.COMPLETED,
				});
				await manager.save(entity);
			}
			await this.startPendingExecutions(manager, id);
			if (dto.exerciseNotes?.length) {
				const currentNotes = await manager.find(WorkoutExerciseNote, {
					where: { workoutId: id },
				});
				const currentNotesByExercise = new Map(
					currentNotes.map((note) => [note.exerciseId, note]),
				);
				const executionExerciseIds = new Set(
					dto.executions.map((execution) => execution.exerciseId),
				);
				for (const input of dto.exerciseNotes) {
					if (!executionExerciseIds.has(input.exerciseId))
						throw new BadRequestException('A nota não pertence a este treino.');
					if (input.athleteNote === undefined) continue;
					const exerciseId = input.exerciseId;
					const athleteNote = input.athleteNote?.trim() || null;
					const note = currentNotesByExercise.get(exerciseId);
					if (note) {
						note.athleteNote = athleteNote;
						note.updatedBy = actor.sub;
						await manager.save(note);
					} else if (athleteNote) {
						await manager.save(
							WorkoutExerciseNote,
							manager.create(WorkoutExerciseNote, {
								workoutId: id,
								exerciseId,
								note: null,
								athleteNote,
								createdBy: actor.sub,
								updatedBy: actor.sub,
							}),
						);
					}
				}
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
		await this.dataSource.transaction(async (manager) => {
			const finishedAt = new Date();
			workout.status = WorkoutStatus.COMPLETED;
			workout.finishedAt = finishedAt;
			workout.updatedBy = actor.sub;
			await manager.save(workout);
			await this.measurementsService.persistForWorkout(manager, id);
		});
		return this.findWorkout(id, actor);
	}

	async skipWorkout(id: string, actor: JwtPayload) {
		const workout = await this.findWritableWorkout(id, actor);
		if (
			![
				WorkoutStatus.PENDING,
				WorkoutStatus.SCHEDULED,
				WorkoutStatus.IN_PROGRESS,
			].includes(workout.status)
		)
			throw new BadRequestException('Este treino não pode mais ser pulado.');

		await this.dataSource.transaction(async (manager) => {
			const finishedAt = new Date();
			await manager
				.createQueryBuilder()
				.update(Execution)
				.set({ status: ExecutionStatus.SKIPPED, finishedAt })
				.where('workout_id = :id', { id })
				.execute();
			workout.status = WorkoutStatus.CANCELLED;
			workout.performedAt = finishedAt;
			workout.finishedAt = finishedAt;
			workout.updatedBy = actor.sub;
			await manager.save(workout);
			await this.measurementsService.persistForWorkout(manager, id);
		});
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

	async createMyWorkout(dto: CreateWorkoutDto, actor: JwtPayload) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta ação é exclusiva para atletas.');

		const startImmediately = dto.startImmediately === true;
		const recordAsCompleted = dto.recordAsCompleted === true;
		const timeZone = dto.clientTimeZone || 'UTC';
		let dateFormatter: Intl.DateTimeFormat;
		try {
			dateFormatter = new Intl.DateTimeFormat('en-GB', {
				timeZone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hourCycle: 'h23',
			});
		} catch {
			throw new BadRequestException('Fuso horário inválido.');
		}
		const localParts = (date: Date) =>
			Object.fromEntries(
				dateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
			);
		const nowParts = localParts(new Date());
		const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
		if (dto.scheduledDate && dto.scheduledDate < today && !recordAsCompleted)
			throw new BadRequestException(
				'Datas passadas só podem ser usadas ao registrar um treino realizado.',
			);
		const recordedAt = dto.performedAt ? new Date(dto.performedAt) : null;
		const performedParts =
			recordedAt && !Number.isNaN(recordedAt.getTime())
				? localParts(recordedAt)
				: null;
		if (
			recordAsCompleted &&
			(!dto.scheduledDate ||
				!recordedAt ||
				Number.isNaN(recordedAt.getTime()) ||
				dto.scheduledDate >= today ||
				recordedAt.getTime() >= Date.now() ||
				recordedAt.getUTCMilliseconds() !== 0 ||
				`${performedParts?.year}-${performedParts?.month}-${performedParts?.day}` !==
					dto.scheduledDate ||
				performedParts?.hour !== '00' ||
				performedParts?.minute !== '00' ||
				performedParts?.second !== '00')
		)
			throw new BadRequestException(
				'Informe uma data e hora passadas para registrar o treino realizado.',
			);
		if (recordAsCompleted && startImmediately)
			throw new BadRequestException(
				'Um treino realizado não pode ser iniciado novamente.',
			);
		const activities = (dto.activities ?? []).map((activity, index) => ({
			...activity,
			position: index + 1,
			type1: 'v' as const,
			type2: activity.type2 ?? 'v',
			setType: activity.setType ?? ExecutionSetType.PADRAO,
		}));
		if (recordAsCompleted && activities.length === 0)
			throw new BadRequestException(
				'Adicione ao menos uma série para registrar um treino realizado.',
			);
		if (recordAsCompleted && activities.some((activity) => activity.type2 === 'p'))
			throw new BadRequestException(
				'Informe as métricas realizadas em valores absolutos, sem porcentagem.',
			);
		if (
			recordAsCompleted &&
			(!Number.isInteger(dto.durationSeconds) || dto.durationSeconds! < 1)
		)
			throw new BadRequestException(
				'Informe uma duração válida para o treino realizado.',
			);
		const athlete = await this.usersService.findOne(actor.sub);
		const defaultName = this.getDefaultWorkoutName(athlete.person.name);
		const workout = await this.dataSource.transaction(async (manager) => {
			const performedAt = recordAsCompleted
				? recordedAt
				: startImmediately ? new Date() : null;
			const created = await manager.save(
				Workout,
				manager.create(Workout, {
					tenantId: null,
					origin: 'athlete',
					athleteId: actor.sub,
					workoutTemplateId: null,
					templateName: dto.name?.trim() || defaultName,
					templateDescription: dto.description?.trim() ?? '',
					scheduledDate: dto.scheduledDate ?? null,
					performedAt,
					finishedAt:
						recordAsCompleted && performedAt
							? new Date(performedAt.getTime() + dto.durationSeconds! * 1000)
							: null,
					excludeFromAchievements: recordAsCompleted,
					status: recordAsCompleted
						? WorkoutStatus.COMPLETED
						: startImmediately
							? WorkoutStatus.IN_PROGRESS
						: dto.scheduledDate
							? WorkoutStatus.SCHEDULED
							: WorkoutStatus.PENDING,
					createdBy: actor.sub,
					updatedBy: actor.sub,
				}),
			);
			const executions = activities.map((activity) => {
				const execution = this.createExecution(manager, created.id, activity);
				if (recordAsCompleted && performedAt) {
					execution.prescribedMetric1 = null;
					execution.prescribedMetric2 = null;
					execution.prescribedPse = null;
					execution.prescribedRestDuration = null;
					execution.metric2Type = null;
					execution.status = ExecutionStatus.COMPLETED;
					execution.performedMetric1 = activity.metric1 ?? null;
					execution.performedMetric2 = activity.metric2 ?? null;
					execution.performedPse = activity.pse ?? null;
					execution.performedRestDuration = activity.restDuration ?? null;
					execution.startedAt = performedAt;
					execution.finishedAt = performedAt;
				}
				return execution;
			});
			await manager.save(Execution, executions);
			if (recordAsCompleted)
				await this.measurementsService.persistForWorkout(manager, created.id);
			if (startImmediately && performedAt)
				await this.startPendingExecutions(manager, created.id, performedAt);
			const notes = this.createExerciseNotes(
				manager,
				created.id,
				activities,
				actor.sub,
				'athleteNote',
			);
			if (notes.length) await manager.save(WorkoutExerciseNote, notes);
			return created;
		});
		return this.findWorkout(workout.id, actor);
	}

	async updateWorkoutName(id: string, name: string, actor: JwtPayload) {
		const workout = await this.findWritableWorkout(id, actor);
		const normalizedName = name.trim();
		if (!normalizedName)
			throw new BadRequestException('Informe o nome do treino.');
		if (
			[WorkoutStatus.COMPLETED, WorkoutStatus.CANCELLED].includes(workout.status)
		)
			throw new BadRequestException(
				'Treinos finalizados ou cancelados não podem ser renomeados.',
			);

		workout.templateName = normalizedName;
		workout.updatedBy = actor.sub;
		await this.dataSource.getRepository(Workout).save(workout);
		return this.findWorkout(id, actor);
	}

	async findAthleteWorkouts(athleteId: string, actor: JwtPayload) {
		const athlete = await this.usersService.findOne(athleteId);
		const access = await this.dataSource.query<{ allowed: boolean }[]>(
			'SELECT can_read_athlete_profile($1::uuid, $2::uuid) AS allowed',
			[athleteId, actor.sub],
		);
		if (!access[0]?.allowed)
			throw new ForbiddenException('Você não pode visualizar este atleta.');
		const workouts = await this.dataSource.getRepository(Workout).createQueryBuilder('w')
			.where('w.athleteId = :athleteId', { athleteId })
			.andWhere('can_read_athlete_workout(w.id, :actorId)', { actorId: actor.sub })
			.orderBy('w.scheduledDate', 'DESC').addOrderBy('w.createdAt', 'DESC').getMany();
		return {
			athlete: { id: athlete.id, name: athlete.person.name },
			workouts: workouts.map((workout) => ({
				id: workout.id,
				templateName: workout.templateName,
				templateDescription: workout.templateDescription,
				scheduledDate: workout.scheduledDate,
				performedAt: workout.performedAt,
				status: workout.status,
			})),
		};
	}

	async createWorkoutForAthlete(
		athleteId: string,
		dto: CreateWorkoutDto,
		actor: JwtPayload,
	) {
		const athlete = await this.ensureCanManageAthleteWorkout(athleteId, actor);
		const workout = await this.createWorkout(
			athlete,
			dto,
			actor.sub,
			actor.tenantId!,
		);
		return this.findWorkout(workout.id, actor);
	}

	async updateWorkoutDraft(
		id: string,
		dto: CreateWorkoutDto,
		actor: JwtPayload,
	) {
		const workout = await this.dataSource
			.getRepository(Workout)
			.findOne({ where: { id } });
		if (!workout) throw new NotFoundException('Treino não encontrado.');
		await this.ensureCanManageAthleteWorkout(workout.athleteId, actor);
		if (workout.tenantId !== actor.tenantId || workout.origin !== 'tenant')
			throw new ForbiddenException('Somente o tenant prescritor pode alterar a prescrição.');
		const currentEpisode = await this.dataSource.getRepository(AthleteTenantAssociation).findOneBy({
			athleteId: workout.athleteId, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
		});
		if (workout.athleteTenantAssociationId !== currentEpisode?.id)
			throw new ForbiddenException('Esta prescrição pertence a um episódio anterior.');
		if (
			![WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED].includes(workout.status)
		)
			throw new BadRequestException(
				'Apenas treinos pendentes ou agendados podem ser editados.',
			);
		if (!dto.name?.trim())
			throw new BadRequestException('Informe o nome do treino.');
		if (!dto.activities?.length)
			throw new BadRequestException('Adicione ao menos uma série ao treino.');

		await this.dataSource.transaction(async (manager) => {
			await manager.delete(WorkoutExerciseNote, { workoutId: workout.id });
			await manager.delete(Execution, { workoutId: workout.id });
			workout.templateName = dto.name!.trim();
			workout.templateDescription = dto.description?.trim() ?? '';
			if (dto.scheduledDate !== undefined) {
				workout.scheduledDate = dto.scheduledDate ?? null;
				workout.status = dto.scheduledDate
					? WorkoutStatus.SCHEDULED
					: WorkoutStatus.PENDING;
			}
			workout.updatedBy = actor.sub;
			await manager.save(workout);
			const activities = dto.activities!.map((activity, index) => ({
				...activity,
				position: index + 1,
				type1: 'v' as const,
				type2: activity.type2 ?? 'v',
				setType: activity.setType,
			}));
			await manager.save(
				Execution,
				activities.map((activity) =>
					this.createExecution(manager, workout.id, activity),
				),
			);
			const notes = this.createExerciseNotes(
				manager,
				workout.id,
				activities,
				actor.sub,
			);
			if (notes.length) await manager.save(WorkoutExerciseNote, notes);
		});
		return this.findWorkout(id, actor);
	}

	async cancelWorkout(id: string, actor: JwtPayload) {
		const workout = await this.dataSource
			.getRepository(Workout)
			.findOne({ where: { id } });
		if (!workout) throw new NotFoundException('Treino não encontrado.');
		if (actor.sub !== workout.athleteId) {
			await this.ensureCanManageAthleteWorkout(workout.athleteId, actor);
			const currentEpisode = await this.dataSource.getRepository(AthleteTenantAssociation).findOneBy({
				athleteId: workout.athleteId, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
			});
			if (workout.origin !== 'tenant' || workout.tenantId !== actor.tenantId ||
				workout.athleteTenantAssociationId !== currentEpisode?.id)
				throw new ForbiddenException('Esta prescrição não pertence ao vínculo ativo.');
		}
		if (
			![WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED].includes(workout.status)
		)
			throw new BadRequestException(
				'Apenas treinos pendentes ou agendados podem ser cancelados.',
			);
		const scheduledDate = workout.scheduledDate;
		workout.status = WorkoutStatus.CANCELLED;
		workout.performedAt = scheduledDate
			? new Date(`${scheduledDate}T12:00:00.000Z`)
			: null;
		workout.updatedBy = actor.sub;
		await this.dataSource.getRepository(Workout).save(workout);
		return this.findWorkout(id, actor);
	}

	async rescheduleWorkout(id: string, scheduledDate: string, actor: JwtPayload) {
		const workout = await this.dataSource
			.getRepository(Workout)
			.findOne({ where: { id } });
		if (!workout) throw new NotFoundException('Treino não encontrado.');
		if (actor.sub !== workout.athleteId)
			throw new ForbiddenException(
				'Somente o atleta deste treino pode reagendá-lo.',
			);
		if (
			![WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED].includes(workout.status)
		)
			throw new BadRequestException(
				'Apenas treinos pendentes ou agendados podem ser reagendados.',
			);
		workout.scheduledDate = scheduledDate;
		workout.status = WorkoutStatus.SCHEDULED;
		workout.updatedBy = actor.sub;
		await this.dataSource.getRepository(Workout).save(workout);
		return this.findWorkout(id, actor);
	}

	private async createWorkout(
		athlete: { id: string; tenantId: string | null; person: { name: string } },
		dto: CreateWorkoutDto,
		createdBy: string,
		tenantId: string,
	) {
		const activities = (dto.activities ?? []).map((activity, index) => ({
			...activity,
			position: index + 1,
			type1: 'v' as const,
			type2: activity.type2 ?? 'v',
			setType: activity.setType ?? ExecutionSetType.PADRAO,
		}));
		return this.dataSource.transaction(async (manager) => {
			const episode = await manager.findOneByOrFail(AthleteTenantAssociation, {
				athleteId: athlete.id, tenantId, status: AthleteTenantStatus.ACTIVE,
			});
			const workout = await manager.save(
				Workout,
				manager.create(Workout, {
					tenantId,
					athleteId: athlete.id,
					origin: 'tenant',
					athleteTenantAssociationId: episode.id,
					workoutTemplateId: null,
					templateName:
						dto.name?.trim() || this.getDefaultWorkoutName(athlete.person.name),
					templateDescription: dto.description?.trim() ?? '',
					scheduledDate: dto.scheduledDate ?? null,
					performedAt: null,
					status: dto.scheduledDate
						? WorkoutStatus.SCHEDULED
						: WorkoutStatus.PENDING,
					createdBy,
					updatedBy: createdBy,
				}),
			);
			if (activities.length)
				await manager.save(
					Execution,
					activities.map((activity) =>
						this.createExecution(manager, workout.id, activity),
					),
				);
			const notes = this.createExerciseNotes(
				manager,
				workout.id,
				activities,
				createdBy,
			);
			if (notes.length) await manager.save(WorkoutExerciseNote, notes);
			return workout;
		});
	}

	private async ensureCanManageAthleteWorkout(
		athleteId: string,
		actor: JwtPayload,
	) {
		const [athlete] = await this.usersService.findTenantUser(
			[athleteId],
			actor.tenantId,
		);
		if (
			!athlete.userRoles.some(
				(role) => role.role === Role.TENANT_CLIENT && !role.deletedAt,
			)
		)
			throw new BadRequestException('O usuário selecionado não é um atleta.');
		const [permission] = await this.dataSource.query<{ allowed: boolean }[]>(
			'SELECT can_prescribe_athlete($1::uuid, $2::uuid) AS allowed', [athleteId, actor.sub]);
		if (!permission?.allowed)
			throw new ForbiddenException(
				'Você só pode gerenciar treinos dos seus atletas vinculados.',
			);
		return this.usersService.findOne(athlete.id);
	}

	private getDefaultWorkoutName(athleteName: string) {
		const parts = new Intl.DateTimeFormat('pt-BR', {
			timeZone: 'America/Sao_Paulo',
			year: 'numeric',
			month: 'short',
			day: '2-digit',
		}).formatToParts(new Date());
		const value = (type: Intl.DateTimeFormatPartTypes) =>
			parts.find((part) => part.type === type)?.value ?? '';
		return `${athleteName} - ${value('year')}/${value('month').toUpperCase().slice(0, 3)} - ${value('day')}`;
	}

	async generateWorkoutFromTemplate(
		input: GenerateWorkoutFromTemplateInput,
	): Promise<Workout> {
		return this.dataSource.transaction(async (manager) => {
			const { template } = input;
			const [permission] = await manager.query<{ allowed: boolean }[]>(
				'SELECT can_prescribe_athlete($1::uuid, $2::uuid) AS allowed', [input.athleteId, input.createdBy]);
			if (!permission?.allowed) throw new ForbiddenException('Vínculo ativo necessário para prescrever.');
			const episode = await manager.findOneByOrFail(AthleteTenantAssociation, {
				athleteId: input.athleteId, tenantId: template.tenantId, status: AthleteTenantStatus.ACTIVE,
			});

			const scheduledDate = input.scheduledDate ?? undefined;
			const workout = await manager.save(
				Workout,
				manager.create(Workout, {
					tenantId: template.tenantId,
					origin: 'tenant',
					athleteTenantAssociationId: episode.id,
					athleteId: input.athleteId,
					workoutTemplateId: template.id,
					templateName: template.name,
					templateDescription: template.description,
					scheduledDate,
					performedAt: null,
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
		const [access] = await this.dataSource.query<{ allowed: boolean }[]>(
			'SELECT can_read_athlete_workout($1::uuid, $2::uuid) AS allowed', [id, actor.sub]);
		if (access?.allowed) return workout;
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
		activity: WorkoutActivityInput,
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
			setType: activity.setType ?? ExecutionSetType.PADRAO,
			status: ExecutionStatus.PENDING,
			startedAt: null,
			finishedAt: null,
		});
	}

	private async startPendingExecutions(
		manager: EntityManager,
		workoutId: string,
		startedAt = new Date(),
	): Promise<void> {
		await manager
			.createQueryBuilder()
			.update(Execution)
			.set({ status: ExecutionStatus.IN_PROGRESS, startedAt })
			.where('workout_id = :workoutId AND status = :status', {
				workoutId,
				status: ExecutionStatus.PENDING,
			})
			.execute();
	}

	private createExerciseNotes(
		manager: EntityManager,
		workoutId: string,
		activities: WorkoutActivityInput[],
		userId: string,
		noteField: 'note' | 'athleteNote' = 'note',
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
				note: noteField === 'note' ? note : null,
				athleteNote: noteField === 'athleteNote' ? note : null,
				createdBy: userId,
				updatedBy: userId,
			}),
		);
	}
}
