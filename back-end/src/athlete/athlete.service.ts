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

@Injectable()
export class AthleteService {
	constructor(
		@InjectRepository(User) private readonly users: Repository<User>,
		@InjectRepository(AthleteTrainerAssociation)
		private readonly associations: Repository<AthleteTrainerAssociation>,
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

	async findTrainers(actor: JwtPayload) {
		this.ensureManager(actor);
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
		this.ensureManager(actor);
		this.ensureValidStartDate(dto.startDate);
		const [athlete, trainer] = await Promise.all([
			this.findTenantUser(dto.athleteId, actor.tenantId),
			this.findTenantUser(dto.trainerId, actor.tenantId),
		]);
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
		this.ensureManager(actor);
		this.ensureValidStartDate(dto.startDate);
		const athleteIds = [...new Set(dto.athleteIds)];
		const trainer = await this.findTenantUser(dto.trainerId, actor.tenantId);
		if (
			!this.hasRole(trainer, Role.TENANT_TRAINER) &&
			!this.hasRole(trainer, Role.TENANT_TRAINER_MASTER)
		) {
			throw new BadRequestException('O usuário selecionado não é um treinador.');
		}

		const athletes = await Promise.all(
			athleteIds.map((id) => this.findTenantUser(id, actor.tenantId)),
		);
		if (athletes.some((athlete) => !this.hasRole(athlete, Role.TENANT_CLIENT))) {
			throw new BadRequestException('Um dos usuários selecionados não é um atleta.');
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
		this.ensureManager(actor);
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

	private async findTenantUser(
		id: string,
		tenantId: string | null,
	): Promise<User> {
		const user = await this.users.findOne({
			where: { id },
			relations: ['userRoles'],
		});
		if (!user) throw new NotFoundException('Usuário não encontrado.');
		if (tenantId && user.tenantId !== tenantId)
			throw new ForbiddenException('Usuário não pertence ao seu tenant.');
		return user;
	}

	private ensureManager(actor: JwtPayload) {
		if (
			!actor.roles.includes(Role.ORG_ADMIN) &&
			!actor.roles.includes(Role.TENANT_ADMIN) &&
			!actor.roles.includes(Role.TENANT_TRAINER_MASTER)
		) {
			throw new ForbiddenException(
				'Somente administradores e treinador master podem gerenciar vínculos.',
			);
		}
	}

	private ensureValidStartDate(startDate: string) {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		const maximum = new Date(today);
		maximum.setUTCDate(maximum.getUTCDate() + 60);
		const requested = new Date(`${startDate}T00:00:00.000Z`);

		if (Number.isNaN(requested.getTime()) || requested < today || requested > maximum) {
			throw new BadRequestException('A data de início deve estar entre hoje e os próximos 60 dias.');
		}
	}

	private hasRole(user: User, role: Role) {
		return user.userRoles.some((item) => item.role === role && !item.deletedAt);
	}
}

class ConflictLikeBadRequest extends BadRequestException {}
