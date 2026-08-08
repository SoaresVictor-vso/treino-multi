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

		const [group, exercise, athlete] = await Promise.all([
			exerciseGroupId ? this.ensureGroup(exerciseGroupId) : null,
			exerciseId ? this.ensureExercise(exerciseId) : null,
			this.findAthlete(dto.athleteId),
		]);

		if (actor.tenantId && actor.tenantId !== athlete.tenantId)
			throw new ForbiddenException('O atleta não pertence ao seu tenant.');

		if (group && athlete.tenantId !== group.tenantId)
			throw new BadRequestException(
				'Atleta e grupo devem pertencer ao mesmo tenant.',
			);

		if (exercise?.tenantId && exercise.tenantId !== athlete.tenantId)
			throw new BadRequestException(
				'O exercício não pertence ao tenant do atleta.',
			);

		return this.records.save(
			this.records.create({
				tenantId: athlete.tenantId!,
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
		return this.records.find({
			where: { athleteId, deletedAt: IsNull() },
			relations: ['exerciseGroup', 'exercise'],
			order: { updatedAt: 'DESC' },
		});
	}

	async getLastByAthleteExercise(
		athleteId: string,
		exerciseId?: number | null,
		exerciseGroupId?: number | null,
	): Promise<PersonalRecord | null> {
		const normalizedExerciseId = exerciseId ?? null;
		const normalizedExerciseGroupId = exerciseGroupId ?? null;
		this.ensureExactlyOneReference(
			normalizedExerciseGroupId,
			normalizedExerciseId,
		);
		const order = { measuredAt: 'DESC' as const, updatedAt: 'DESC' as const };
		if (normalizedExerciseGroupId) {
			return this.records.findOne({
				where: {
					athleteId,
					exerciseGroupId: normalizedExerciseGroupId,
					deletedAt: IsNull(),
				},
				order,
			});
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

	private async ensureGroup(groupId: number): Promise<ExerciseGroup> {
		const group = await this.groups.findOne({ where: { id: groupId } });
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
		if (
			actor.roles.some((role) => [Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role))
		)
			return;
		if (
			actor.roles.includes(Role.TENANT_ADMIN) &&
			actor.tenantId === athlete.tenantId
		)
			return;
		if (actor.sub === athlete.id) return;
		if (
			actor.roles.some((role) =>
				[Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER].includes(role),
			)
		) {
			const association = await this.associations.existsBy({
				athleteId: athlete.id,
				trainerId: actor.sub,
				endDate: IsNull(),
			});
			if (association) return;
		}
		throw new ForbiddenException('Você não pode consultar os 1RMs deste atleta.');
	}

	private async findManagedOne(id: string, actor: JwtPayload) {
		const record = await this.records.findOne({ where: { id } });
		if (!record) throw new NotFoundException('1RM não encontrado.');
		if (actor.tenantId && record.tenantId !== actor.tenantId) {
			throw new ForbiddenException('O 1RM não pertence ao seu tenant.');
		}
		return record;
	}
}
