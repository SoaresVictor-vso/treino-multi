import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { WorkoutStatus } from '../common/enums/workout-status.enum';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutsService } from './workouts.service';

const input = {
	templateId: 'e8af5c95-2c06-41e0-9dab-1d31e7dbb837',
	athleteId: '1c2723db-2c78-4375-a408-d43d2494a6a2',
	tenantId: '3c99542d-88b6-4c2e-9eec-622a149aeb6b',
	createdBy: '6f5caec5-72b0-434e-80e9-59b6a921f60a',
};

describe('WorkoutsService', () => {
	let service: WorkoutsService;
	const manager = {
		findOne: jest.fn(),
		create: jest.fn((_: unknown, entity: unknown) => entity),
		save: jest.fn(),
	};
	const dataSource = {
		transaction: jest.fn((callback) => callback(manager)),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module = await Test.createTestingModule({
			providers: [WorkoutsService, { provide: DataSource, useValue: dataSource }],
		}).compile();
		service = module.get(WorkoutsService);
	});

	it('gera um treino pendente e copia as prescrições da template', async () => {
		manager.findOne.mockResolvedValue({
			id: input.templateId,
			name: 'Treino A',
			description: 'Descrição',
			activities: [
				{
					exerciseId: 1,
					metric1: 3,
					metric2: 12,
					pse: 7,
					restDuration: 60,
					note: 'Controle a cadência',
				},
			],
		});
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });

		await service.generateWorkoutFromTemplate(input);

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.findOne).toHaveBeenCalledWith(
			WorkoutTemplate,
			expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
		);
		expect(manager.save).toHaveBeenNthCalledWith(
			1,
			Workout,
			expect.objectContaining({
				scheduledDate: null,
				status: WorkoutStatus.PENDING,
			}),
		);
		expect(manager.save).toHaveBeenNthCalledWith(
			2,
			Execution,
			expect.arrayContaining([
				expect.objectContaining({
					position: 1,
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
		manager.findOne.mockResolvedValue({
			id: input.templateId,
			name: 'Treino A',
			description: '',
			activities: [],
		});
		manager.save.mockResolvedValueOnce({ id: 'workout-id' });

		await service.generateWorkoutFromTemplate({
			...input,
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

	it('reverte a transação quando a template não existe no tenant', async () => {
		manager.findOne.mockResolvedValue(null);

		await expect(service.generateWorkoutFromTemplate(input)).rejects.toThrow(
			NotFoundException,
		);
		expect(manager.save).not.toHaveBeenCalled();
	});
});
