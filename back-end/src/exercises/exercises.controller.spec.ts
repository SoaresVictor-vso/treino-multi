import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';

describe('ExercisesController', () => {
	const service = {
		findAll: jest.fn(),
		findChangesSince: jest.fn(),
	};
	const controller = new ExercisesController(
		service as unknown as ExercisesService,
	);

	beforeEach(() => jest.clearAllMocks());

	it('lista os exercícios ativos', () => {
		const exercises = [{ id: 1, name: 'Agachamento' }];
		service.findAll.mockReturnValue(exercises);

		expect(controller.findAll()).toEqual(exercises);
	});

	it('busca alterações desde a data informada', async () => {
		const since = '2026-07-31T10:00:00.000Z';
		const changes = {
			exercises: [],
			deletedIds: [2],
			syncedAt: '2026-07-31T10:05:00.000Z',
		};
		service.findChangesSince.mockResolvedValue(changes);

		await expect(controller.findChanges({ since })).resolves.toEqual(changes);
		expect(service.findChangesSince).toHaveBeenCalledWith(new Date(since));
	});

	it('busca todos os exercícios quando since é nulo', async () => {
		const changes = {
			exercises: [{ id: 1, name: 'Agachamento' }],
			deletedIds: [],
			syncedAt: '2026-07-31T10:05:00.000Z',
		};
		service.findChangesSince.mockResolvedValue(changes);

		await expect(controller.findChanges({ since: null })).resolves.toEqual(
			changes,
		);
		expect(service.findChangesSince).toHaveBeenCalledWith(null);
	});
});
