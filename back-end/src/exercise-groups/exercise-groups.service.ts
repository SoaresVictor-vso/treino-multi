import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Role } from '../common/enums/role.enum';
import { AddExerciseToGroupDto } from './dto/add-exercise-to-group.dto';
import { CreateExerciseGroupDto } from './dto/create-exercise-group.dto';
import { UpdateExerciseGroupDto } from './dto/update-exercise-group.dto';
import { ExerciseGroupExercise } from './entities/exercise-group-exercise.entity';
import { ExerciseGroup } from './entities/exercise-group.entity';

@Injectable()
export class ExerciseGroupsService {
	constructor(
		@InjectRepository(ExerciseGroup)
		private readonly groups: Repository<ExerciseGroup>,
		@InjectRepository(ExerciseGroupExercise)
		private readonly memberships: Repository<ExerciseGroupExercise>,
		@InjectRepository(Exercise)
		private readonly exercises: Repository<Exercise>,
	) {}

	async create(dto: CreateExerciseGroupDto, actor: JwtPayload) {
		const tenantId = this.resolveTenant(dto.tenantId, actor);
		const exercises = await this.findExercisesByIds(dto.exerciseIds);
		this.ensureExercisesBelongToTenant(exercises, tenantId);
		this.ensureGroupExercisesMatchMetrics(
			exercises,
			dto.metric1Id,
			dto.metric2Id ?? null,
		);
		const group = await this.groups.save(
			this.groups.create({
				name: dto.name.trim(),
				tenantId,
				metric1Id: dto.metric1Id,
				metric2Id: dto.metric2Id ?? null,
				createdBy: actor.sub,
				updatedBy: actor.sub,
				deletedBy: null,
			}),
		);
		await this.memberships.save(
			exercises.map((exercise) =>
				this.memberships.create({
					exerciseGroupId: group.id,
					exerciseId: exercise.id,
					createdBy: actor.sub,
					deletedBy: null,
				}),
			),
		);
		return group;
	}

	async findAll(actor: JwtPayload) {
		return this.groups.find({
			where: actor.tenantId ? { tenantId: actor.tenantId } : {},
			relations: ['metric1', 'metric2'],
			order: { name: 'ASC' },
		});
	}

	async findOne(id: number, actor: JwtPayload) {
		const group = await this.groups.findOne({
			where: { id, ...(actor.tenantId && { tenantId: actor.tenantId }) },
			relations: ['metric1', 'metric2'],
		});
		if (!group)
			throw new NotFoundException('Grupo de exercícios não encontrado.');
		return group;
	}

	async findExercises(id: number, actor: JwtPayload) {
		await this.findOne(id, actor);
		return this.memberships.find({
			where: { exerciseGroupId: id, deletedAt: IsNull() },
			relations: ['exercise'],
			order: { createdAt: 'ASC' },
		});
	}

	async update(id: number, dto: UpdateExerciseGroupDto, actor: JwtPayload) {
		const [group, exercisesToAdd] = await Promise.all([
			this.findManagedOne(id, actor),
			dto.exerciseIdsToAdd ? this.findExercisesByIds(dto.exerciseIdsToAdd) : [],
		]);
		const currentExercises = group.activeExercises ?? [];

		const exerciseIdsToRemove = new Set(dto.exerciseIdsToRemove ?? []);
		const currentIds = new Set(currentExercises.map(({ id }) => id));
		if (
			[...exerciseIdsToRemove].some((exerciseId) => !currentIds.has(exerciseId))
		) {
			throw new BadRequestException(
				'Um ou mais exercícios a remover não pertencem ao grupo.',
			);
		}
		if (
			exercisesToAdd.some(({ id }) => currentIds.has(id)) ||
			exercisesToAdd.some(({ id }) => exerciseIdsToRemove.has(id))
		) {
			throw new BadRequestException(
				'Um exercício não pode já pertencer ao grupo ou ser adicionado e removido na mesma atualização.',
			);
		}
		const exercises = [
			...currentExercises.filter(
				({ id: exerciseId }) => !exerciseIdsToRemove.has(exerciseId),
			),
			...exercisesToAdd,
		];
		this.ensureExercisesBelongToTenant(exercises, group.tenantId);
		this.ensureGroupExercisesMatchMetrics(
			exercises,
			group.metric1Id,
			group.metric2Id,
		);
		Object.assign(group, {
			...(dto.name !== undefined && { name: dto.name.trim() }),
			updatedBy: actor.sub,
		});
		return this.groups.manager.transaction(async (manager) => {
			const updatedGroup = await manager.save(ExerciseGroup, group);
			await Promise.all([
				this.addExercises(id, exercisesToAdd, actor.sub, manager),
				this.removeExercises(id, dto.exerciseIdsToRemove ?? [], actor.sub, manager),
			]);
			return updatedGroup;
		});
	}

	async remove(id: number, actor: JwtPayload): Promise<void> {
		const group = await this.findManagedOne(id, actor);
		group.deletedBy = actor.sub;
		await this.groups.save(group);
		await this.groups.softRemove(group);
	}

	async addExercise(id: number, dto: AddExerciseToGroupDto, actor: JwtPayload) {
		const group = await this.findManagedOne(id, actor);
		const exercise = await this.exercises.findOne({
			where: { id: dto.exerciseId },
		});
		if (!exercise) throw new NotFoundException('Exercício não encontrado.');
		this.ensureExercisesBelongToTenant([exercise], group.tenantId);
		const groupExercises = await this.findActiveExercises(id);
		this.ensureGroupExercisesMatchMetrics(
			[...groupExercises, exercise],
			group.metric1Id,
			group.metric2Id,
		);
		const existing = await this.memberships.findOne({
			where: {
				exerciseGroupId: id,
				exerciseId: dto.exerciseId,
				deletedAt: IsNull(),
			},
		});
		if (existing)
			throw new ConflictException('O exercício já pertence ao grupo.');
		return this.memberships.save(
			this.memberships.create({
				exerciseGroupId: id,
				exerciseId: dto.exerciseId,
				createdBy: actor.sub,
				deletedBy: null,
			}),
		);
	}

	async removeExercise(
		id: number,
		exerciseId: number,
		actor: JwtPayload,
	): Promise<void> {
		await this.findManagedOne(id, actor);
		const membership = await this.memberships.findOne({
			where: { exerciseGroupId: id, exerciseId, deletedAt: IsNull() },
		});
		if (!membership)
			throw new NotFoundException('Exercício não pertence ao grupo.');
		membership.deletedBy = actor.sub;
		await this.memberships.save(membership);
		await this.memberships.softRemove(membership);
	}

	private async findManagedOne(
		id: number,
		actor: JwtPayload,
	): Promise<ExerciseGroup & { activeExercises?: Exercise[] }> {
		const query = this.groups
			.createQueryBuilder('group')
			.leftJoin(
				ExerciseGroupExercise,
				'membership',
				'membership.exerciseGroupId = group.id AND membership.deletedAt IS NULL',
			)
			.leftJoinAndMapMany(
				'group.activeExercises',
				Exercise,
				'exercise',
				'exercise.id = membership.exerciseId',
			)
			.where('group.id = :id', { id })
			.andWhere('group.deletedAt IS NULL');
		if (actor.tenantId) {
			query.andWhere('group.tenantId = :tenantId', { tenantId: actor.tenantId });
		}
		const group = await query.getOne();
		if (!group)
			throw new NotFoundException('Grupo de exercícios não encontrado.');
		return group;
	}

	private resolveTenant(
		requestedTenantId: string | undefined,
		actor: JwtPayload,
	) {
		if (actor.tenantId) {
			if (requestedTenantId && requestedTenantId !== actor.tenantId) {
				throw new ForbiddenException(
					'Não é permitido criar grupos para outro tenant.',
				);
			}
			return actor.tenantId;
		}
		if (
			!actor.roles.some((role) =>
				[Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role),
			)
		) {
			throw new ForbiddenException('Tenant deve ser informado.');
		}
		if (!requestedTenantId)
			throw new BadRequestException('tenantId é obrigatório.');
		return requestedTenantId;
	}

	private async findActiveExercises(groupId: number): Promise<Exercise[]> {
		const memberships = await this.memberships.find({
			where: { exerciseGroupId: groupId, deletedAt: IsNull() },
			relations: ['exercise'],
		});
		return memberships.map(({ exercise }) => exercise);
	}

	private async findExercisesByIds(exerciseIds: number[]): Promise<Exercise[]> {
		const exercises = await this.exercises.findBy({ id: In(exerciseIds) });
		if (exercises.length !== exerciseIds.length) {
			throw new NotFoundException('Um ou mais exercícios não foram encontrados.');
		}
		return exercises;
	}

	private ensureExercisesBelongToTenant(
		exercises: Exercise[],
		tenantId: string,
	) {
		if (
			exercises.some(
				(exercise) => exercise.tenantId && exercise.tenantId !== tenantId,
			)
		) {
			throw new BadRequestException(
				'Todos os exercícios devem ser globais ou pertencer ao tenant do grupo.',
			);
		}
	}

	private async addExercises(
		groupId: number,
		exercises: Exercise[],
		actorId: string,
		manager: EntityManager,
	) {
		if (!exercises.length) return;
		await manager.save(
			ExerciseGroupExercise,
			exercises.map((exercise) =>
				manager.create(ExerciseGroupExercise, {
					exerciseGroupId: groupId,
					exerciseId: exercise.id,
					createdBy: actorId,
					deletedBy: null,
				}),
			),
		);
	}

	private async removeExercises(
		groupId: number,
		exerciseIds: number[],
		actorId: string,
		manager: EntityManager,
	) {
		if (!exerciseIds.length) return;
		const memberships = await manager.find(ExerciseGroupExercise, {
			where: {
				exerciseGroupId: groupId,
				exerciseId: In(exerciseIds),
				deletedAt: IsNull(),
			},
		});
		for (const membership of memberships) membership.deletedBy = actorId;
		await manager.save(ExerciseGroupExercise, memberships);
		await manager.softRemove(ExerciseGroupExercise, memberships);
	}

	/** Revalida o conjunto inteiro, inclusive grupos legados. */
	private ensureGroupExercisesMatchMetrics(
		exercises: Exercise[],
		metric1Id: number,
		metric2Id: number | null,
	) {
		const incompatible = exercises.some(
			(exercise) =>
				exercise.metric1Id !== metric1Id || exercise.metric2Id !== metric2Id,
		);
		if (incompatible) {
			throw new BadRequestException(
				'Todos os exercícios do grupo devem possuir as mesmas métricas, na mesma ordem.',
			);
		}
	}
}
