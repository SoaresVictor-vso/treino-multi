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
import { AthleteTenantAssociation } from './entities/athlete-tenant-association.entity';
import { AthleteTenantStatus } from '../common/enums/athlete-tenant-status.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class AthleteService {
	constructor(
		@InjectRepository(User) private readonly users: Repository<User>,
		@InjectRepository(AthleteTrainerAssociation)
		private readonly associations: Repository<AthleteTrainerAssociation>,
		private readonly usersService: UsersService,
		private readonly dataSource: DataSource,
	) {}

	async findAthletes(actor: JwtPayload, selectedTenantId?: string) {
		const tenantId = this.resolveReadTenantId(actor, selectedTenantId);
		const isTrainer = actor.roles.includes(Role.TENANT_TRAINER);
		const qb = this.users
			.createQueryBuilder('athlete')
			.innerJoin(AthleteTenantAssociation, 'tenantAssociation',
				'tenantAssociation.athleteId = athlete.id AND tenantAssociation.tenantId = :tenantId AND tenantAssociation.status = :active',
				{ tenantId, active: AthleteTenantStatus.ACTIVE })
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
				'association.athleteTenantAssociationId = tenantAssociation.id AND association.endDate IS NULL',
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

		if (isTrainer)
			qb.andWhere('association.trainerId = :trainerId', { trainerId: actor.sub });

		const rows = await qb
			.select([
				'athlete.id AS athlete_id',
				'tenantAssociation.tenant_id AS athlete_tenant_id',
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

	private resolveReadTenantId(actor: JwtPayload, selectedTenantId?: string): string {
		if (actor.tenantId) {
			if (selectedTenantId && selectedTenantId !== actor.tenantId)
				throw new ForbiddenException('Tenant fora do seu contexto.');
			return actor.tenantId;
		}
		if (!actor.roles.includes(Role.ORG_ADMIN))
			throw new ForbiddenException('Contexto de tenant necessário.');
		if (!selectedTenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedTenantId))
			throw new BadRequestException('Selecione um tenant válido.');
		return selectedTenantId;
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
		if (!actor.tenantId) throw new ForbiddenException('Contexto de tenant necessário.');
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
		if (trainer.tenantId !== actor.tenantId) throw new ForbiddenException('Treinador fora do tenant.');

		return this.dataSource.transaction(async (manager) => {
			const episode = await manager.findOneByOrFail(AthleteTenantAssociation, {
				athleteId: athlete.id, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
			});
			const current = await manager.findOne(AthleteTrainerAssociation, {
				where: { athleteTenantAssociationId: episode.id, trainerId: trainer.id, endDate: IsNull() },
			});
			if (current) throw new ConflictLikeBadRequest('O atleta já está associado a este treinador.');
			return manager.save(
				AthleteTrainerAssociation,
				manager.create(AthleteTrainerAssociation, {
					athleteId: athlete.id,
					trainerId: trainer.id,
					athleteTenantAssociationId: episode.id,
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
		if (!actor.tenantId) throw new ForbiddenException('Contexto de tenant necessário.');
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
		if (trainer.tenantId !== actor.tenantId) throw new ForbiddenException('Treinador fora do tenant.');

		return this.dataSource.transaction(async (manager) => {
			for (const athlete of athletes) {
				const episode = await manager.findOneByOrFail(AthleteTenantAssociation, {
					athleteId: athlete.id, tenantId: actor.tenantId!, status: AthleteTenantStatus.ACTIVE,
				});
				const current = await manager.findOne(AthleteTrainerAssociation, {
					where: { athleteTenantAssociationId: episode.id, trainerId: trainer.id, endDate: IsNull() },
				});
				if (current) continue;
				await manager.save(
					AthleteTrainerAssociation,
					manager.create(AthleteTrainerAssociation, {
						athleteId: athlete.id,
						trainerId: trainer.id,
						athleteTenantAssociationId: episode.id,
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
		const episode = association.athleteTenantAssociationId && await this.dataSource.getRepository(AthleteTenantAssociation)
			.findOneBy({ id: association.athleteTenantAssociationId, status: AthleteTenantStatus.ACTIVE });
		if (!actor.tenantId || !episode || episode.tenantId !== actor.tenantId)
			throw new ForbiddenException('O vínculo não pertence ao seu tenant.');
		association.endDate = endDate ?? new Date().toISOString().slice(0, 10);
		association.endedByUserId = actor.sub;
		return this.associations.save(association);
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
