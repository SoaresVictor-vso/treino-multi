import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { Person } from '../persons/entities/person.entity';
import { CreateAthleteTrainerAssociationDto } from './dto/create-athlete-trainer-association.dto';
import { CreateAthleteTrainerAssociationsDto } from './dto/create-athlete-trainer-associations.dto';
import { AthleteTrainerAssociation } from './entities/athlete-trainer-association.entity';
import { WorkoutsService } from '../workouts/workouts.service';
import { Workout } from '../workouts/entities/workout.entity';
import { GenerateWorkoutsFromTemplateDto } from './dto/generate-workouts-from-template.dto';
import { UsersService } from '../users/users.service';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { WorkoutStatus } from '../common/enums/workout-status.enum';

@Injectable()
export class AthleteService {
	constructor(
		@InjectRepository(User) private readonly users: Repository<User>,
		@InjectRepository(AthleteTrainerAssociation)
		private readonly associations: Repository<AthleteTrainerAssociation>,
		@InjectRepository(WorkoutTemplate)
		private readonly templates: Repository<WorkoutTemplate>,
		private readonly workoutsService: WorkoutsService,
		private readonly usersService: UsersService,
		private readonly dataSource: DataSource,
	) {}

	async findAthletes(actor: JwtPayload) {
		const isTrainer = actor.roles.includes(Role.TENANT_TRAINER);
		const qb = this.users
			.createQueryBuilder('athlete')
			.innerJoin('athlete.person', 'person')
			.innerJoin(
				'athlete.userRoles',
				'athleteRole',
				'athleteRole.deletedAt IS NULL AND athleteRole.role = :athleteRole',
				{ athleteRole: Role.TENANT_CLIENT },
			)
			.leftJoinAndMapOne(
				'athlete.activeAssociation',
				AthleteTrainerAssociation,
				'association',
				'association.athleteId = athlete.id AND association.endDate IS NULL',
			)
			.leftJoinAndMapOne(
				'association.trainer',
				User,
				'trainer',
				'trainer.id = association.trainerId',
			)
			.leftJoinAndMapOne(
				'trainer.person',
				Person,
				'trainerPerson',
				'trainerPerson.id = trainer.personId',
			)
			.orderBy('person.name', 'ASC');

		if (actor.tenantId)
			qb.andWhere('athlete.tenantId = :tenantId', { tenantId: actor.tenantId });
		if (isTrainer)
			qb.andWhere('association.trainerId = :trainerId', { trainerId: actor.sub });

		const rows = await qb
			.select([
				'athlete.id AS athlete_id',
				'athlete.tenant_id AS athlete_tenant_id',
				'athlete.is_active AS athlete_is_active',
				'person.name AS person_name',
				'person.email AS person_email',
				'person.phone AS person_phone',
				'association.id AS association_id',
				'association.data_inicio AS association_start_date',
				'trainer.id AS trainer_id',
				'trainerPerson.name AS trainer_name',
			])
			.getRawMany<{
				athlete_id: string;
				athlete_tenant_id: string;
				athlete_is_active: boolean;
				person_name: string;
				person_email: string | null;
				person_phone: string | null;
				association_id: string | null;
				association_start_date: string | null;
				trainer_id: string | null;
				trainer_name: string | null;
			}>();

		return rows.map((row) => ({
			id: row.athlete_id,
			tenantId: row.athlete_tenant_id,
			isActive: row.athlete_is_active,
			person: {
				name: row.person_name,
				email: row.person_email,
				phone: row.person_phone,
			},
			activeAssociation: row.association_id
				? {
						id: row.association_id,
						startDate: row.association_start_date,
						trainer: { id: row.trainer_id, person: { name: row.trainer_name } },
					}
				: null,
		}));
	}

	async findMyWorkouts(actor: JwtPayload) {
		if (!actor.roles.includes(Role.TENANT_CLIENT))
			throw new ForbiddenException('Esta consulta é exclusiva para atletas.');

		const workouts = await this.dataSource
			.getRepository(Workout)
			.createQueryBuilder('workout')
			.where('workout.athleteId = :athleteId', { athleteId: actor.sub })
			.andWhere('workout.tenantId = :tenantId', { tenantId: actor.tenantId })
			.andWhere('workout.status IN (:...statuses)', {
				statuses: [WorkoutStatus.PENDING, WorkoutStatus.SCHEDULED],
			})
			.orderBy('workout.scheduledDate', 'ASC', 'NULLS FIRST')
			.addOrderBy('workout.createdAt', 'DESC')
			.select([
				'workout.id AS id',
				'workout.template_name AS "templateName"',
				'workout.template_description AS "templateDescription"',
				'workout.scheduled_date AS "scheduledDate"',
				'workout.status AS status',
			])
			.getRawMany<{
				id: string;
				templateName: string;
				templateDescription: string;
				scheduledDate: string | null;
				status: WorkoutStatus;
			}>();

		return workouts;
	}

	async findTrainers(actor: JwtPayload) {
		const qb = this.users
			.createQueryBuilder('trainer')
			.innerJoin('trainer.person', 'person')
			.innerJoin(
				'trainer.userRoles',
				'trainerRole',
				'trainerRole.deletedAt IS NULL AND trainerRole.role IN (:...roles)',
				{
					roles: [Role.TENANT_TRAINER, Role.TENANT_TRAINER_MASTER],
				},
			)
			.where('trainer.isActive = true')
			.orderBy('person.name', 'ASC');
		if (actor.tenantId)
			qb.andWhere('trainer.tenantId = :tenantId', { tenantId: actor.tenantId });
		return qb
			.select(['trainer.id AS id', 'person.name AS name'])
			.getRawMany()
			.then((rows) =>
				rows.map((row: { id: string; name: string }) => ({
					id: row.id,
					person: { name: row.name },
				})),
			);
	}

	async createAssociation(
		dto: CreateAthleteTrainerAssociationDto,
		actor: JwtPayload,
	) {
		this.ensureValidStartDate(dto.startDate);
		const [athlete, trainer] = await this.usersService.findTenantUser(
			[dto.athleteId, dto.trainerId],
			actor.tenantId,
		);
		if (!this.hasRole(athlete, Role.TENANT_CLIENT))
			throw new BadRequestException('O usuário selecionado não é um atleta.');
		if (
			!this.hasRole(trainer, Role.TENANT_TRAINER) &&
			!this.hasRole(trainer, Role.TENANT_TRAINER_MASTER)
		) {
			throw new BadRequestException('O usuário selecionado não é um treinador.');
		}
		if (athlete.tenantId !== trainer.tenantId)
			throw new BadRequestException(
				'Atleta e treinador devem pertencer ao mesmo tenant.',
			);

		return this.dataSource.transaction(async (manager) => {
			const current = await manager.findOne(AthleteTrainerAssociation, {
				where: { athleteId: athlete.id, endDate: IsNull() },
			});
			if (current) {
				if (current.trainerId === trainer.id)
					throw new ConflictLikeBadRequest(
						'O atleta já está associado a este treinador.',
					);
				current.endDate = dto.startDate;
				current.endedByUserId = actor.sub;
				await manager.save(current);
			}
			return manager.save(
				AthleteTrainerAssociation,
				manager.create(AthleteTrainerAssociation, {
					athleteId: athlete.id,
					trainerId: trainer.id,
					startDate: dto.startDate,
					startedByUserId: actor.sub,
					endDate: null,
					endedByUserId: null,
				}),
			);
		});
	}

	async createAssociations(
		dto: CreateAthleteTrainerAssociationsDto,
		actor: JwtPayload,
	) {
		this.ensureValidStartDate(dto.startDate);
		const athleteIds = [...new Set(dto.athleteIds)];
		const [trainer, ...athletes] = await this.usersService.findTenantUser(
			[dto.trainerId, ...athleteIds],
			actor.tenantId,
		);
		if (
			!this.hasRole(trainer, Role.TENANT_TRAINER) &&
			!this.hasRole(trainer, Role.TENANT_TRAINER_MASTER)
		) {
			throw new BadRequestException('O usuário selecionado não é um treinador.');
		}

		if (athletes.some((athlete) => !this.hasRole(athlete, Role.TENANT_CLIENT))) {
			throw new BadRequestException(
				'Um dos usuários selecionados não é um atleta.',
			);
		}
		if (athletes.some((athlete) => athlete.tenantId !== trainer.tenantId)) {
			throw new BadRequestException(
				'Atletas e treinador devem pertencer ao mesmo tenant.',
			);
		}

		return this.dataSource.transaction(async (manager) => {
			for (const athlete of athletes) {
				const current = await manager.findOne(AthleteTrainerAssociation, {
					where: { athleteId: athlete.id, endDate: IsNull() },
				});
				if (current) {
					if (current.trainerId === trainer.id) continue;
					current.endDate = dto.startDate;
					current.endedByUserId = actor.sub;
					await manager.save(current);
				}
				await manager.save(
					AthleteTrainerAssociation,
					manager.create(AthleteTrainerAssociation, {
						athleteId: athlete.id,
						trainerId: trainer.id,
						startDate: dto.startDate,
						startedByUserId: actor.sub,
						endDate: null,
						endedByUserId: null,
					}),
				);
			}
			return { count: athletes.length };
		});
	}

	async endAssociation(
		id: string,
		endDate: string | undefined,
		actor: JwtPayload,
	) {
		const association = await this.associations.findOne({
			where: { id, endDate: IsNull() },
			relations: ['athlete'],
		});
		if (!association)
			throw new NotFoundException('Vínculo ativo não encontrado.');
		if (actor.tenantId && association.athlete.tenantId !== actor.tenantId)
			throw new ForbiddenException('O vínculo não pertence ao seu tenant.');
		association.endDate = endDate ?? new Date().toISOString().slice(0, 10);
		association.endedByUserId = actor.sub;
		return this.associations.save(association);
	}

	async generateWorkoutsFromTemplate(
		dto: GenerateWorkoutsFromTemplateDto,
		actor: JwtPayload,
	) {
		const athleteIds = [...new Set(dto.athleteIds)];
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
		if (athletes.some((athlete) => !this.hasRole(athlete, Role.TENANT_CLIENT))) {
			throw new BadRequestException(
				'Um dos usuários selecionados não é um atleta.',
			);
		}

		if (!template)
			throw new NotFoundException('Template de treino não encontrado.');

		const workouts: Workout[] = [];
		for (const athlete of athletes) {
			workouts.push(
				await this.workoutsService.generateWorkoutFromTemplate({
					template,
					athleteId: athlete.id,
					createdBy: actor.sub,
					scheduledDate: dto.scheduledDate,
				}),
			);
		}
		return { count: workouts.length, workouts };
	}

	private ensureValidStartDate(startDate: string) {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		const maximum = new Date(today);
		maximum.setUTCDate(maximum.getUTCDate() + 60);
		const requested = new Date(`${startDate}T00:00:00.000Z`);

		if (
			Number.isNaN(requested.getTime()) ||
			requested < today ||
			requested > maximum
		) {
			throw new BadRequestException(
				'A data de início deve estar entre hoje e os próximos 60 dias.',
			);
		}
	}

	private hasRole(user: User, role: Role) {
		return user.userRoles.some((item) => item.role === role && !item.deletedAt);
	}
}

class ConflictLikeBadRequest extends BadRequestException {}
