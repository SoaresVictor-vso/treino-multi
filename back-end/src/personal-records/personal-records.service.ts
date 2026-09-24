import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { ExerciseGroup } from '../exercise-groups/entities/exercise-group.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { AthleteTenantAssociation } from '../athlete/entities/athlete-tenant-association.entity';
import { AthleteTenantStatus } from '../common/enums/athlete-tenant-status.enum';
import { User } from '../users/entities/user.entity';
import { CreatePersonalRecordDto } from './dto/create-personal-record.dto';
import { UpdatePersonalRecordDto } from './dto/update-personal-record.dto';
import { PersonalRecord } from './entities/personal-record.entity';

@Injectable()
export class PersonalRecordsService {
	constructor(
		@InjectRepository(PersonalRecord)
		private readonly records: Repository<PersonalRecord>,
		@InjectRepository(ExerciseGroup)
		private readonly groups: Repository<ExerciseGroup>,
		@InjectRepository(Exercise)
		private readonly exercises: Repository<Exercise>,
		@InjectRepository(User)
		private readonly users: Repository<User>,
		@InjectRepository(AthleteTrainerAssociation)
		private readonly associations: Repository<AthleteTrainerAssociation>,
	) {}

	async create(dto: CreatePersonalRecordDto, actor: JwtPayload) {
		const exerciseGroupId = dto.exerciseGroupId ?? null;
		const exerciseId = dto.exerciseId ?? null;
		this.ensureExactlyOneReference(exerciseGroupId, exerciseId);

		const [exercise, athlete] = await Promise.all([
			exerciseId ? this.ensureExercise(exerciseId) : null,
			this.findAthlete(dto.athleteId),
		]);
		const group = exerciseGroupId
			? await this.ensureGroup(exerciseGroupId, actor.tenantId)
			: null;
		await this.assertCanReadAthlete(athlete, actor);
		const own = actor.sub === athlete.id;
		const episode = !own && await this.records.manager.getRepository(AthleteTenantAssociation).findOneBy({
			athleteId: athlete.id, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
		});
		if (!own && !episode) throw new ForbiddenException('Vínculo ativo necessário.');
		if (group && !own && group.tenantId !== actor.tenantId)
			throw new BadRequestException('Grupo fora do tenant.');
		if (exercise?.tenantId && !own && exercise.tenantId !== actor.tenantId)
			throw new BadRequestException(
				'O exercício não pertence ao tenant do operador.',
			);

		return this.records.save(
			this.records.create({
				tenantId: own ? null : actor.tenantId,
				origin: own ? 'athlete' : 'tenant',
				athleteTenantAssociationId: episode ? episode.id : null,
				athleteId: athlete.id,
				exerciseGroupId: group?.id ?? null,
				exerciseId: exercise?.id ?? null,
				value: dto.value,
				measuredAt: dto.measuredAt,
				createdBy: actor.sub,
				updatedBy: actor.sub,
				deletedBy: null,
			}),
		);
	}

	async findByAthlete(athleteId: string, actor: JwtPayload) {
		const athlete = await this.findAthlete(athleteId);
		await this.assertCanReadAthlete(athlete, actor);
		return this.records
			.createQueryBuilder('record')
			.leftJoinAndSelect('record.exerciseGroup', 'exerciseGroup')
			.leftJoinAndSelect('record.exercise', 'exercise')
			.where('record.athlete_id = :athleteId', { athleteId })
			.andWhere('record.deleted_at IS NULL')
			.andWhere('can_read_personal_record(record.id, :actorId)', { actorId: actor.sub })
			.orderBy('record.updated_at', 'DESC')
			.getMany();
	}

	async getLastByAthleteExercise(
		athleteId: string,
		exerciseId?: number | null,
		exerciseGroupId?: number | null,
	): Promise<PersonalRecord | null> {
		const athlete = await this.users.findOne({ where: { id: athleteId } });
		if (!athlete) return null;
		const normalizedExerciseId = exerciseId ?? null;
		const normalizedExerciseGroupId = exerciseGroupId ?? null;
		this.ensureExactlyOneReference(
			normalizedExerciseGroupId,
			normalizedExerciseId,
		);
		const order = { measuredAt: 'DESC' as const, updatedAt: 'DESC' as const };
		if (normalizedExerciseGroupId) {
			return this.records
				.createQueryBuilder('record')
				.innerJoin('record.exerciseGroup', 'exerciseGroup')
				.where('record.athlete_id = :athleteId', { athleteId })
				.andWhere('record.exercise_group_id = :exerciseGroupId', {
					exerciseGroupId: normalizedExerciseGroupId,
				})
				.andWhere('record.deleted_at IS NULL')
				.andWhere('exerciseGroup.deleted_at IS NULL')
				.orderBy('record.measured_at', order.measuredAt)
				.addOrderBy('record.updated_at', order.updatedAt)
				.getOne();
		}
		if (normalizedExerciseId === null) {
			throw new BadRequestException(
				'Informe exatamente um: exerciseGroupId ou exerciseId.',
			);
		}
		return this.records.findOne({
			where: {
				athleteId,
				exerciseId: normalizedExerciseId,
				deletedAt: IsNull(),
			},
			order,
		});
	}

	async update(id: string, dto: UpdatePersonalRecordDto, actor: JwtPayload) {
		const record = await this.findManagedOne(id, actor);
		if (dto.exerciseId !== undefined && record.exerciseGroupId !== null) {
			throw new BadRequestException(
				'Um 1RM vinculado a grupo não pode receber um exercício.',
			);
		}
		const exerciseId = dto.exerciseId ?? record.exerciseId;
		this.ensureExactlyOneReference(record.exerciseGroupId, exerciseId);
		if (exerciseId) {
			const exercise = await this.ensureExercise(exerciseId);
			if (exercise.tenantId && exercise.tenantId !== record.tenantId) {
				throw new BadRequestException(
					'O exercício não pertence ao tenant do atleta.',
				);
			}
		}
		Object.assign(record, {
			...(dto.exerciseId !== undefined && { exerciseId }),
			...(dto.value !== undefined && { value: dto.value }),
			...(dto.measuredAt !== undefined && { measuredAt: dto.measuredAt }),
			updatedBy: actor.sub,
		});
		return this.records.save(record);
	}

	async remove(id: string, actor: JwtPayload): Promise<void> {
		const record = await this.findManagedOne(id, actor);
		record.deletedBy = actor.sub;
		await this.records.save(record);
		await this.records.softRemove(record);
	}

	private async ensureGroup(
		groupId: number,
		tenantId: string | null,
	): Promise<ExerciseGroup> {
		const group = await this.groups.findOne({
			where: { id: groupId, ...(tenantId && { tenantId }) },
		});
		if (!group) {
			throw new NotFoundException('Grupo de exercícios não encontrado.');
		}
		return group;
	}

	private async ensureExercise(exerciseId: number): Promise<Exercise> {
		const exercise = await this.exercises.findOne({ where: { id: exerciseId } });
		if (!exercise) throw new NotFoundException('Exercício não encontrado.');
		return exercise;
	}

	private ensureExactlyOneReference(
		exerciseGroupId: number | null,
		exerciseId: number | null,
	) {
		if ((exerciseGroupId === null) === (exerciseId === null)) {
			throw new BadRequestException(
				'Informe exatamente um: exerciseGroupId ou exerciseId.',
			);
		}
	}

	private async findAthlete(id: string) {
		const athlete = await this.users.findOne({
			where: { id },
			relations: ['userRoles'],
		});
		if (!athlete) throw new NotFoundException('Atleta não encontrado.');
		if (
			!athlete.userRoles.some(
				(role) => role.role === Role.TENANT_CLIENT && !role.deletedAt,
			)
		) {
			throw new BadRequestException('O usuário informado não é um atleta.');
		}
		return athlete;
	}

	private async assertCanReadAthlete(athlete: User, actor: JwtPayload) {
		const [access] = await this.records.manager.query<{ allowed: boolean }[]>(
			'SELECT can_read_athlete_profile($1::uuid,$2::uuid) AS allowed', [athlete.id, actor.sub]);
		if (access?.allowed) return;
		throw new ForbiddenException('Você não pode consultar os 1RMs deste atleta.');
	}

	private async findManagedOne(id: string, actor: JwtPayload) {
		const record = await this.records.findOne({ where: { id } });
		if (!record) throw new NotFoundException('1RM não encontrado.');
		if (actor.sub !== record.athleteId) {
			const [permission] = await this.records.manager.query<{ allowed: boolean }[]>(
				'SELECT can_prescribe_athlete($1::uuid,$2::uuid) AS allowed', [record.athleteId, actor.sub]);
			const currentEpisode = await this.records.manager.getRepository(AthleteTenantAssociation).findOneBy({
				athleteId: record.athleteId, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
			});
			if (!permission?.allowed || record.tenantId !== actor.tenantId || record.origin !== 'tenant' ||
				record.athleteTenantAssociationId !== currentEpisode?.id)
				throw new ForbiddenException('O 1RM não pertence ao seu tenant.');
		}
		return record;
	}
}
