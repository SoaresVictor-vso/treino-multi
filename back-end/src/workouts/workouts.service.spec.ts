import { enums } from '@treino-multi/shared';
const { ExecutionStatus, Role, WorkoutStatus } = enums;
type ExecutionStatus = enums.ExecutionStatus;
type Role = enums.Role;
type WorkoutStatus = enums.WorkoutStatus;
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { AthleteTenantAssociation } from '../athlete/entities/athlete-tenant-association.entity';
import { UsersService } from '../users/users.service';



import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutsService } from './workouts.service';
import { MeasurementsService } from '../measurements/measurements.service';

const input = {
	template: {
		id: 'e8af5c95-2c06-41e0-9dab-1d31e7dbb837',
		tenantId: '3c99542d-88b6-4c2e-9eec-622a149aeb6b',
		name: 'Treino A',
		description: 'Descrição',
		activities: [],
	} as WorkoutTemplate,
	athleteId: '1c2723db-2c78-4375-a408-d43d2494a6a2',
	createdBy: '6f5caec5-72b0-434e-80e9-59b6a921f60a',
};

describe('WorkoutsService', () => {
	let service: WorkoutsService;
	const manager = {
		findOne: jest.fn(),
		findOneByOrFail: jest.fn(),
		query: jest.fn(),
		createQueryBuilder: jest.fn(),
		create: jest.fn((_: unknown, entity: unknown) => entity),
		save: jest.fn(),
	};
	const dataSource = {
		transaction: jest.fn((callback: (manager: typeof manager) => unknown) =>
			callback(manager),
		),
		query: jest.fn(),
	};
	const associations = { findBy: jest.fn() };

	beforeEach(async () => {
		jest.clearAllMocks();
		manager.query.mockResolvedValue([{ allowed: true }]);
		manager.findOneByOrFail.mockResolvedValue({ id: 'episode-id' });
		manager.createQueryBuilder = jest.fn(() => ({ update: () => ({ set: () => ({
			where: () => ({ execute: jest.fn() }),
		}) }) })) as any;
		const module = await Test.createTestingModule({
			providers: [
				WorkoutsService,
				{ provide: DataSource, useValue: dataSource },
				{
					provide: getRepositoryToken(AthleteTrainerAssociation),
					useValue: associations,
				},
				{ provide: getRepositoryToken(WorkoutTemplate), useValue: {} },
				{ provide: UsersService, useValue: {} },
				{ provide: MeasurementsService, useValue: { persistForWorkout: jest.fn() } },
			],
		}).compile();
		service = module.get(WorkoutsService);
	});

	it('gera um treino pendente e copia as prescrições da template', async () => {
		const template = {
			...input.template,
			activities: [
				{
					exerciseId: 1,
					position: 3,
					metric1: 3,
					metric2: 12,
					type1: 'v',
					type2: 'p',
					pse: 7,
					restDuration: 60,
					note: 'Controle a cadência',
				},
			],
		} as WorkoutTemplate;
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });

		await service.generateWorkoutFromTemplate({ ...input, template });

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.save).toHaveBeenNthCalledWith(
			1,
			Workout,
			expect.objectContaining({
				scheduledDate: undefined,
				status: WorkoutStatus.PENDING,
			}),
		);
		expect(manager.save).toHaveBeenNthCalledWith(
			2,
			Execution,
			expect.arrayContaining([
				expect.objectContaining({
					position: 3,
					metric1Type: 'v',
					metric2Type: 'p',
					status: ExecutionStatus.PENDING,
				}),
			]),
		);
		expect(manager.save).toHaveBeenNthCalledWith(
			3,
			WorkoutExerciseNote,
			expect.arrayContaining([
				expect.objectContaining({ note: 'Controle a cadência' }),
			]),
		);
	});

	it('gera treino agendado quando recebe uma data', async () => {
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });

		await service.generateWorkoutFromTemplate({
			...input,
			template: { ...input.template, description: '' },
			scheduledDate: '2026-08-10',
		});

		expect(manager.save).toHaveBeenCalledWith(
			Workout,
			expect.objectContaining({
				scheduledDate: '2026-08-10',
				status: WorkoutStatus.SCHEDULED,
			}),
		);
	});

	it('registra a data de início ao criar e iniciar um treino próprio', async () => {
		Object.assign((service as any).usersService, {
			findOne: jest.fn().mockResolvedValue({ person: { name: 'Atleta' } }),
		});
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });
		jest
			.spyOn(service, 'findWorkout')
			.mockResolvedValue({ id: 'workout-id' } as never);

		await service.createMyWorkout(
			{ startImmediately: true },
			{
				sub: input.athleteId,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_CLIENT],
			},
		);

		expect(manager.save).toHaveBeenCalledWith(
			Workout,
			expect.objectContaining({
				status: WorkoutStatus.IN_PROGRESS,
				performedAt: expect.any(Date),
			}),
		);
	});

	it('cria um treino próprio agendado com a data informada', async () => {
		Object.assign((service as any).usersService, {
			findOne: jest.fn().mockResolvedValue({ person: { name: 'Atleta' } }),
		});
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });
		jest
			.spyOn(service, 'findWorkout')
			.mockResolvedValue({ id: 'workout-id' } as never);

		const scheduledDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		await service.createMyWorkout(
			{ scheduledDate },
			{
				sub: input.athleteId,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_CLIENT],
			},
		);

		expect(manager.save).toHaveBeenCalledWith(
			Workout,
			expect.objectContaining({
				scheduledDate,
				status: WorkoutStatus.SCHEDULED,
			}),
		);
	});

	it('inclui treinos pendentes e agendados na agenda do atleta', async () => {
		dataSource.query.mockResolvedValueOnce([
			{ workouts: [], total: '0', inProgress: null },
		]);

		await service.findMyAgendaWorkouts({
			sub: input.athleteId,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_CLIENT],
		});

		const query = dataSource.query.mock.calls[0][0] as string;
		expect(query).toContain(
			"workout.status IN ('pending', 'scheduled', 'in_progress')",
		);
		expect(query).toContain("WHERE status IN ('pending', 'scheduled')");
		expect(query).toContain(
			"COUNT(*) FILTER (WHERE workout.status IN ('pending', 'scheduled')) OVER() AS total",
		);
	});

	it('lista para o treinador apenas os treinos dos seus atletas vinculados', async () => {
		const rows = [
			{
				id: 'workout-id',
				athleteId: input.athleteId,
				athleteName: 'Atleta',
				templateName: 'Treino A',
				templateDescription: 'Descrição',
				scheduledDate: null,
				performedAt: null,
				status: WorkoutStatus.IN_PROGRESS,
			},
		];
		const query = jest.fn().mockResolvedValue(rows);
		Object.assign(dataSource, { query });

		await expect(
			service.findTrainerWorkouts({
				sub: input.createdBy,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_TRAINER],
			}),
		).resolves.toEqual(rows);
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining("workout.status = 'completed'"),
			[input.createdBy],
		);
	});

	it.each([Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER])(
		'lista todos os treinos do tenant para %s',
		async (role) => {
			const query = jest.fn().mockResolvedValue([]);
			Object.assign(dataSource, { query });

			await service.findTrainerWorkouts({
				sub: input.createdBy,
				tenantId: input.template.tenantId,
				roles: [role],
			});

			expect(query).toHaveBeenCalledWith(
				expect.stringContaining('can_read_athlete_workout(workout.id, $1)'),
				[input.createdBy],
			);
		},
	);

	it('impede atletas de consultarem o painel de treinador', async () => {
		await expect(
			service.findTrainerWorkouts({
				sub: input.athleteId,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_CLIENT],
			}),
		).rejects.toThrow(
			'Esta consulta é exclusiva para administradores e treinadores.',
		);
	});

	it('permite visualizar o perfil com lista vazia quando o escopo não permite nenhum treino', async () => {
		const user = { id: input.athleteId, person: { name: 'Atleta' } };
		const queryBuilder = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};
		const repo = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) };
		Object.assign(dataSource, { getRepository: jest.fn().mockReturnValue(repo) });
		Object.assign(service['usersService'], { findOne: jest.fn().mockResolvedValue(user) });
		dataSource.query.mockResolvedValue([{ allowed: true }]);

		await expect(service.findAthleteWorkouts(input.athleteId, {
			sub: input.createdBy,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_ADMIN],
		})).resolves.toEqual({ athlete: { id: input.athleteId, name: 'Atleta' }, workouts: [] });
		expect(dataSource.query).toHaveBeenCalledWith(
			'SELECT can_read_athlete_profile($1::uuid, $2::uuid) AS allowed',
			[input.athleteId, input.createdBy],
		);
	});

	it('nega o perfil independentemente da quantidade de treinos', async () => {
		Object.assign(service['usersService'], { findOne: jest.fn().mockResolvedValue({ id: input.athleteId, person: { name: 'Atleta' } }) });
		dataSource.query.mockResolvedValue([{ allowed: false }]);
		await expect(service.findAthleteWorkouts(input.athleteId, {
			sub: input.createdBy,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_TRAINER],
		})).rejects.toThrow('Você não pode visualizar este atleta.');
	});

	it('impede o treinador de atribuir treino a atletas sem vínculo ativo', async () => {
		associations.findBy.mockResolvedValue([]);

		await expect(
			service.generateWorkoutsFromTemplate(
				{ athleteIds: [input.athleteId], templateId: input.template.id },
				{
					sub: input.createdBy,
					tenantId: input.template.tenantId,
					roles: [Role.TENANT_TRAINER],
				},
			),
		).rejects.toThrow(
			'Você só pode atribuir treinos aos seus atletas vinculados.',
		);
	});

	it('impede iniciar um treino quando o atleta já tem outro em andamento', async () => {
		const workout = {
			id: 'workout-id',
			athleteId: input.athleteId,
			status: WorkoutStatus.PENDING,
		} as Workout;
		const workoutRepository = {
			existsBy: jest.fn().mockResolvedValue(true),
		};
		Object.assign(manager, {
			query: jest.fn().mockResolvedValue(undefined),
			getRepository: jest.fn().mockReturnValue(workoutRepository),
		});
		jest.spyOn(service as any, 'findWritableWorkout').mockResolvedValue(workout);

		await expect(
			service.startWorkout('workout-id', {
				sub: input.athleteId,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_CLIENT],
			}),
		).rejects.toThrow('Já existe um treino em andamento para este atleta.');

		expect(workoutRepository.existsBy).toHaveBeenCalledWith({
			athleteId: input.athleteId,
			status: WorkoutStatus.IN_PROGRESS,
		});
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('impede alteração estrutural pelo atleta em treino criado pelo treinador', async () => {
		const workout = {
			id: 'workout-id',
			athleteId: input.athleteId,
			createdBy: input.createdBy,
			status: WorkoutStatus.IN_PROGRESS,
		} as Workout;
		Object.assign(manager, { find: jest.fn().mockResolvedValue([{
			id: 10,
			exerciseId: 1,
			position: 1,
			prescribedMetric1: 10,
			prescribedMetric2: null,
			prescribedPse: null,
			prescribedRestDuration: 60,
			setType: 'padrao',
		}]) });
		jest.spyOn(service as any, 'findWritableWorkout').mockResolvedValue(workout);

		await expect(service.updateExecutions(workout.id, {
			executions: [{ id: 10, exerciseId: 1, position: 2 }],
		}, {
			sub: input.athleteId,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_CLIENT],
		})).rejects.toThrow('Somente o autor do treino pode alterar sua estrutura.');
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('impede iniciar um treino percentual sem os RPs necessários', async () => {
		const workout = {
			id: 'workout-id',
			athleteId: input.athleteId,
			status: WorkoutStatus.PENDING,
		} as Workout;
		const workoutRepository = {
			existsBy: jest.fn().mockResolvedValue(false),
		};
		Object.assign(manager, {
			query: jest
				.fn()
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce([{ name: 'SUPINO RETO' }]),
			getRepository: jest.fn().mockReturnValue(workoutRepository),
		});
		jest.spyOn(service as any, 'findWritableWorkout').mockResolvedValue(workout);

		await expect(
			service.startWorkout('workout-id', {
				sub: input.athleteId,
				tenantId: input.template.tenantId,
				roles: [Role.TENANT_CLIENT],
			}),
		).rejects.toThrow(
			'Cadastre os RPs necessários antes de iniciar o treino: SUPINO RETO.',
		);

		expect(workoutRepository.existsBy).not.toHaveBeenCalled();
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('pula todas as séries e cancela o treino do próprio atleta', async () => {
		const workout = {
			id: 'workout-id',
			status: WorkoutStatus.IN_PROGRESS,
		} as Workout;
		const execute = jest.fn();
		const queryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute,
		};
		Object.assign(manager, {
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
		});
		jest.spyOn(service as any, 'findWritableWorkout').mockResolvedValue(workout);
		jest
			.spyOn(service, 'findWorkout')
			.mockResolvedValue({ id: workout.id } as never);

		await service.skipWorkout(workout.id, {
			sub: input.athleteId,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_CLIENT],
		});

		expect(queryBuilder.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: ExecutionStatus.SKIPPED }),
		);
		expect(queryBuilder.where).toHaveBeenCalledWith('workout_id = :id', {
			id: workout.id,
		});
		expect(execute).toHaveBeenCalled();
		expect(workout.status).toBe(WorkoutStatus.CANCELLED);
		expect(workout.performedAt).toBeInstanceOf(Date);
		expect(manager.save).toHaveBeenCalledWith(
			expect.objectContaining({
				updatedBy: input.athleteId,
				performedAt: expect.any(Date),
			}),
		);
	});

	it('preserva a data de início ao concluir o treino', async () => {
		const startedAt = new Date('2026-09-12T10:00:00.000Z');
		const workout = {
			id: 'workout-id',
			status: WorkoutStatus.IN_PROGRESS,
			performedAt: startedAt,
		} as Workout;
		const executionRepository = { count: jest.fn().mockResolvedValue(0) };
		const workoutRepository = { save: jest.fn().mockResolvedValue(workout) };
		Object.assign(dataSource, {
			getRepository: jest
				.fn()
				.mockReturnValueOnce(executionRepository)
				.mockReturnValueOnce(workoutRepository),
		});
		jest.spyOn(service as any, 'findWritableWorkout').mockResolvedValue(workout);
		jest
			.spyOn(service, 'findWorkout')
			.mockResolvedValue({ id: workout.id } as never);

		await service.completeWorkout(workout.id, {
			sub: input.athleteId,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_CLIENT],
		});

		expect(executionRepository.count).toHaveBeenCalled();
		expect(workout.status).toBe(WorkoutStatus.COMPLETED);
		expect(workout.performedAt).toBe(startedAt);
		expect(manager.save).toHaveBeenCalledWith(
			expect.objectContaining({
				performedAt: expect.any(Date),
				updatedBy: input.athleteId,
			}),
		);
	});

	it('registra a data de execução ao cancelar um treino agendado', async () => {
		const workout = {
			id: 'workout-id',
			athleteId: input.athleteId,
			tenantId: input.template.tenantId,
			origin: 'tenant',
			athleteTenantAssociationId: 'episode-id',
			status: WorkoutStatus.SCHEDULED,
			scheduledDate: '2026-09-21',
			performedAt: null,
		} as Workout;
		const repository = {
			findOne: jest.fn().mockResolvedValue(workout),
			save: jest.fn().mockResolvedValue(workout),
		};
		Object.assign(dataSource, {
			getRepository: jest.fn((entity: unknown) => entity === AthleteTenantAssociation
				? { findOneBy: jest.fn().mockResolvedValue({ id: 'episode-id' }) } : repository),
		});
		jest
			.spyOn(service as any, 'ensureCanManageAthleteWorkout')
			.mockResolvedValue(undefined);
		jest
			.spyOn(service, 'findWorkout')
			.mockResolvedValue({ id: workout.id } as never);

		await service.cancelWorkout(workout.id, {
			sub: input.createdBy,
			tenantId: input.template.tenantId,
			roles: [Role.TENANT_TRAINER],
		});

		expect(workout.status).toBe(WorkoutStatus.CANCELLED);
		expect(workout.performedAt).toEqual(new Date('2026-09-21T12:00:00.000Z'));
		expect(repository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				performedAt: new Date('2026-09-21T12:00:00.000Z'),
				updatedBy: input.createdBy,
			}),
		);
	});
});
