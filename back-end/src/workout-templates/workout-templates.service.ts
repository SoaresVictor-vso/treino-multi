import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { resolvePermissions } from '../common/enums/role-permissions.map';
import { CreateWorkoutTemplateDto } from './dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './dto/update-workout-template.dto';
import { Activity } from './entities/activity.entity';
import { WorkoutTemplate } from './entities/workout-template.entity';

type TemplateOperation = 'read' | 'update' | 'delete';

const OPERATION_PERMISSIONS: Record<
	TemplateOperation,
	[Permission, Permission, Permission]
> = {
	read: [
		Permission.WORKOUT_TEMPLATES_READ,
		Permission.WORKOUT_TEMPLATES_READ_TENANT,
		Permission.WORKOUT_TEMPLATES_READ_ALL,
	],
	update: [
		Permission.WORKOUT_TEMPLATES_UPDATE,
		Permission.WORKOUT_TEMPLATES_UPDATE_TENANT,
		Permission.WORKOUT_TEMPLATES_UPDATE_ALL,
	],
	delete: [
		Permission.WORKOUT_TEMPLATES_DELETE,
		Permission.WORKOUT_TEMPLATES_DELETE_TENANT,
		Permission.WORKOUT_TEMPLATES_DELETE_ALL,
	],
};

@Injectable()
export class WorkoutTemplatesService {
	constructor(
		@InjectRepository(WorkoutTemplate)
		private readonly templateRepo: Repository<WorkoutTemplate>,
		@InjectRepository(Exercise)
		private readonly exerciseRepo: Repository<Exercise>,
		private readonly dataSource: DataSource,
	) {}

	async create(
		dto: CreateWorkoutTemplateDto,
		actor: JwtPayload,
	): Promise<WorkoutTemplate> {
		this.ensurePermission(actor, Permission.WORKOUT_TEMPLATES_CREATE);
		if (actor.tenantId && dto.tenantId !== actor.tenantId) {
			throw new ForbiddenException(
				'Não é permitido criar templates em outro tenant.',
			);
		}
		await this.ensureExercises(dto.activities);
		return this.dataSource.transaction(async (manager) => {
			const { activities: _activities, ...templateDto } = dto;
			const template = await manager.save(
				WorkoutTemplate,
				manager.create(WorkoutTemplate, {
					...templateDto,
					createdBy: actor.sub,
					updatedBy: actor.sub,
				}),
			);
			if (dto.activities.length) {
				await manager.save(
					Activity,
					dto.activities.map((activity) =>
						manager.create(Activity, { ...activity, workoutTemplateId: template.id }),
					),
				);
			}
			return this.getOneOrFail(template.id, manager);
		});
	}

	findAll(
		actor: JwtPayload,
	): Promise<
		Array<{ id: string; name: string; description: string; exercises: string[] }>
	> {
		const permissions = resolvePermissions(actor.roles as Role[]);
		const exercisesSubquery = this.templateRepo
			.createQueryBuilder('t')
			.leftJoin('t.activities', 'a')
			.leftJoin('a.exercise', 'e')
			.select(
				'ARRAY_AGG(DISTINCT e.name) FILTER (WHERE e.name IS NOT NULL)',
				'exercises',
			)
			.where('t.id = template.id');

		const query = this.templateRepo
			.createQueryBuilder('template')
			.select('template.id', 'id')
			.addSelect('template.name', 'name')
			.addSelect('template.description', 'description')
			.addSelect(`(${exercisesSubquery.getQuery()})`, 'exercises')
			.setParameters(exercisesSubquery.getParameters())
			.orderBy('template.createdAt', 'DESC');

		if (!permissions.includes(Permission.WORKOUT_TEMPLATES_READ_ALL)) {
			if (
				permissions.includes(Permission.WORKOUT_TEMPLATES_READ_TENANT) &&
				actor.tenantId
			) {
				if (permissions.includes(Permission.WORKOUT_TEMPLATES_READ)) {
					query.where('template.createdBy = :actorId', { actorId: actor.sub });
				}
			} else if (permissions.includes(Permission.WORKOUT_TEMPLATES_READ)) {
				query.where('template.createdBy = :actorId', { actorId: actor.sub });
			} else {
				throw new ForbiddenException(
					'Você não possui permissão para acessar templates de treino.',
				);
			}
		}

		return query.getRawMany();
	}

	async findOne(id: string, actor: JwtPayload): Promise<WorkoutTemplate> {
		const template = await this.getOneOrFail(id, this.templateRepo.manager);
		this.ensureAccess(template, actor, 'read');
		return template;
	}

	async update(
		id: string,
		dto: UpdateWorkoutTemplateDto,
		actor: JwtPayload,
	): Promise<WorkoutTemplate> {
		const template = await this.getOneOrFail(id, this.templateRepo.manager);
		this.ensureAccess(template, actor, 'update');
		if (dto.activities) await this.ensureExercises(dto.activities);
		const existingActivities = template.activities;
		const receivedIds = dto.activities
			?.map((activity) => activity.id)
			.filter((activityId): activityId is number => activityId !== undefined);
		if (receivedIds && new Set(receivedIds).size !== receivedIds.length) {
			throw new BadRequestException('Há activities duplicadas na atualização.');
		}
		const existingIds = new Set(
			existingActivities.map((activity) => activity.id),
		);
		if (receivedIds?.some((activityId) => !existingIds.has(activityId))) {
			throw new NotFoundException(
				'Uma ou mais activities não pertencem à template.',
			);
		}
		return this.dataSource.transaction(async (manager) => {
			const { activities: _activities, tenantId: _tenantId, ...updateDto } = dto;
			await manager.save(
				WorkoutTemplate,
				Object.assign(template, updateDto, { updatedBy: actor.sub }),
			);
			if (dto.activities) {
				const retainedIds = new Set(receivedIds);
				const removedIds = existingActivities
					.filter((activity) => !retainedIds.has(activity.id))
					.map((activity) => activity.id);
				if (removedIds.length) {
					await manager.delete(Activity, {
						id: In(removedIds),
						workoutTemplateId: id,
					});
				}
				const activitiesToUpdate = dto.activities.filter(
					(activity) => activity.id !== undefined,
				);
				const activitiesToCreate = dto.activities.filter(
					(activity) => activity.id === undefined,
				);
				if (activitiesToUpdate.length) {
					await manager.save(
						Activity,
						activitiesToUpdate.map((activity) =>
							manager.create(Activity, { ...activity, workoutTemplateId: id }),
						),
					);
				}
				if (activitiesToCreate.length) {
					await manager.save(
						Activity,
						activitiesToCreate.map((activity) =>
							manager.create(Activity, { ...activity, workoutTemplateId: id }),
						),
					);
				}
			}
			return this.getOneOrFail(id, manager);
		});
	}

	async remove(id: string, actor: JwtPayload): Promise<void> {
		try {
			const template = await this.getOneOrFail(id, this.templateRepo.manager);
			this.ensureAccess(template, actor, 'delete');
			await this.templateRepo.softRemove(template);
		} catch (error) {
			console.error(error);
		}
	}

	private ensureAccess(
		template: WorkoutTemplate,
		actor: JwtPayload,
		operation: TemplateOperation,
	): void {
		const [own, tenant, all] = OPERATION_PERMISSIONS[operation];
		const permissions = resolvePermissions(actor.roles as Role[]);
		if (
			!permissions.includes(all) &&
			!(permissions.includes(tenant) && actor.tenantId === template.tenantId) &&
			!(permissions.includes(own) && actor.sub === template.createdBy)
		) {
			throw new ForbiddenException(
				'Você não possui permissão para acessar este template de treino.',
			);
		}
	}

	private ensurePermission(actor: JwtPayload, permission: Permission): void {
		if (!resolvePermissions(actor.roles as Role[]).includes(permission)) {
			throw new ForbiddenException(
				`Acesso negado: permissão ausente: ${permission}`,
			);
		}
	}

	private async ensureExercises(
		activities: { exerciseId: number }[],
	): Promise<void> {
		const exerciseIds = [
			...new Set(activities.map((activity) => activity.exerciseId)),
		];
		if (!exerciseIds.length) return;
		const count = await this.exerciseRepo.countBy({ id: In(exerciseIds) });
		if (count !== exerciseIds.length)
			throw new NotFoundException('Um ou mais exercícios não foram encontrados.');
	}

	private async getOneOrFail(
		id: string,
		manager: EntityManager,
	): Promise<WorkoutTemplate> {
		const template = await manager.findOne(WorkoutTemplate, {
			where: { id },
			relations: [
				'activities',
				'activities.exercise',
				'activities.exercise.metric1',
				'activities.exercise.metric2',
			],
		});
		if (!template)
			throw new NotFoundException(`Template de treino ${id} não encontrado.`);
		return template;
	}
}
