import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Role } from '../common/enums/role.enum';
import { WorkoutTemplate } from './entities/workout-template.entity';
import { Activity } from './entities/activity.entity';
import { WorkoutTemplatesService } from './workout-templates.service';

const uuid = 'd2719f58-929d-4c18-b0d5-1ec3213918be';
const actor = { sub: uuid, tenantId: uuid, roles: [Role.ORG_ADMIN] } as any;
const makeTemplate = (): WorkoutTemplate => ({
	id: uuid,
	tenantId: uuid,
	createdBy: uuid,
	updatedBy: uuid,
	name: 'Treino A',
	description: '',
	createdAt: new Date(),
	updatedAt: new Date(),
	activities: [],
	tenant: {} as any,
	creator: {} as any,
	updater: {} as any,
	deletedAt: null,
});

describe('WorkoutTemplatesService', () => {
	let service: WorkoutTemplatesService;
	let templateRepo: jest.Mocked<Repository<WorkoutTemplate>>;
	let exerciseRepo: jest.Mocked<Repository<Exercise>>;
	let manager: jest.Mocked<
		Pick<EntityManager, 'create' | 'save' | 'findOne' | 'delete' | 'query'>
	>;
	let queryBuilder: Record<string, jest.Mock>;

	beforeEach(async () => {
		manager = {
			create: jest.fn((_entity, value) => value),
			save: jest.fn(),
			findOne: jest.fn(),
			delete: jest.fn(),
			query: jest.fn(),
		} as unknown as jest.Mocked<
			Pick<EntityManager, 'create' | 'save' | 'findOne' | 'delete' | 'query'>
		>;
		queryBuilder = {
			leftJoin: jest.fn(),
			select: jest.fn(),
			addSelect: jest.fn(),
			groupBy: jest.fn(),
			addGroupBy: jest.fn(),
			orderBy: jest.fn(),
			where: jest.fn(),
			orWhere: jest.fn(),
			getQuery: jest.fn(),
			getParameters: jest.fn(),
			setParameters: jest.fn(),
			getRawMany: jest.fn(),
		};
		Object.values(queryBuilder).forEach((method) =>
			method.mockReturnValue(queryBuilder),
		);

		const module = await Test.createTestingModule({
			providers: [
				WorkoutTemplatesService,
				{
					provide: getRepositoryToken(WorkoutTemplate),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						softRemove: jest.fn(),
						manager,
						createQueryBuilder: jest.fn(() => queryBuilder),
					},
				},
				{ provide: getRepositoryToken(Exercise), useValue: { countBy: jest.fn() } },
				{
					provide: DataSource,
					useValue: {
						transaction: jest.fn((callback) => callback(manager)),
					},
				},
			],
		}).compile();
		service = module.get(WorkoutTemplatesService);
		templateRepo = module.get(getRepositoryToken(WorkoutTemplate));
		exerciseRepo = module.get(getRepositoryToken(Exercise));
	});

	it('cria template e suas atividades em transação', async () => {
		const template = makeTemplate();
		exerciseRepo.countBy.mockResolvedValue(1);
		manager.save.mockResolvedValueOnce(template);
		manager.findOne.mockResolvedValue(template);
		await expect(
			service.create(
				{
					tenantId: uuid,
					name: 'Treino A',
					description: '',
					activities: [{ exerciseId: 1, type1: 'v', pse: 8 }],
				},
				actor,
			),
		).resolves.toEqual(template);
		expect(manager.save).toHaveBeenCalledTimes(2);
	});

	it('rejeita template com exercício ausente', async () => {
		exerciseRepo.countBy.mockResolvedValue(0);
		await expect(
			service.create(
				{
					tenantId: uuid,
					name: 'Treino A',
					description: '',
					activities: [{ exerciseId: 1, type1: 'v', pse: 8 }],
				},
				actor,
			),
		).rejects.toThrow(NotFoundException);
	});

	it('lista, atualiza atividades e remove logicamente o template existente', async () => {
		const template = makeTemplate();
		templateRepo.find.mockResolvedValue([template]);
		templateRepo.findOne.mockResolvedValue(template);
		exerciseRepo.countBy.mockResolvedValue(1);
		manager.findOne.mockResolvedValue(template);
		queryBuilder.getRawMany.mockResolvedValue([
			{
				id: uuid,
				name: 'Treino A',
				description: '',
				exercises: ['Supino'],
			},
		]);
		await expect(service.findAll(actor)).resolves.toEqual([
			{
				id: uuid,
				name: 'Treino A',
				description: '',
				exercises: ['Supino'],
			},
		]);
		expect(queryBuilder.select).toHaveBeenCalledWith(
			expect.stringContaining('COALESCE(ARRAY_AGG'),
			'exercises',
		);
		await service.update(
			uuid,
			{ activities: [{ exerciseId: 1, type1: 'v', pse: 7 }] },
			actor,
		);
		expect(manager.save).toHaveBeenCalled();
		await service.remove(uuid, actor);
		expect(templateRepo.softRemove).toHaveBeenCalledWith(template);
	});

	it('atualiza activities mantidas, cria novas e remove apenas as ausentes', async () => {
		const template = makeTemplate();
		template.activities = [
			{ id: 10, workoutTemplateId: uuid, exerciseId: 1 } as Activity,
			{ id: 11, workoutTemplateId: uuid, exerciseId: 1 } as Activity,
		];
		exerciseRepo.countBy.mockResolvedValue(2);
		manager.findOne.mockResolvedValue(template);

		await service.update(
			uuid,
			{
				activities: [
					{ id: 10, exerciseId: 1, type1: 'v', pse: 7 },
					{ exerciseId: 2, type1: 'v', pse: 8 },
				],
			},
			actor,
		);

		expect(manager.delete).toHaveBeenCalledWith(
			Activity,
			expect.objectContaining({ workoutTemplateId: uuid }),
		);
		expect(manager.query).toHaveBeenCalledWith(
			expect.stringContaining('SET "position" = -"id"'),
			[uuid, [10]],
		);
		expect(manager.save).toHaveBeenCalledTimes(2);
		expect(manager.save).toHaveBeenLastCalledWith(
			Activity,
			expect.arrayContaining([
				expect.objectContaining({ id: 10, position: 1 }),
				expect.objectContaining({ exerciseId: 2, position: 2 }),
			]),
		);
	});
});
