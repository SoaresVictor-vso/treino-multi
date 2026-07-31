import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../metrics/entities/metric.entity';
import { Exercise } from './entities/exercise.entity';
import { ExercisesService } from './exercises.service';

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1, name: 'Agachamento', description: 'Exercício de base', tenantId: null, metric1Id: 1, metric2Id: null, visualUrl: null,
  createdAt: new Date(), updatedAt: new Date(), metric1: {} as Metric, metric2: null, ...overrides,
});

describe('ExercisesService', () => {
  let service: ExercisesService;
  let exerciseRepo: jest.Mocked<Repository<Exercise>>;
  let metricRepo: jest.Mocked<Repository<Metric>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [
      ExercisesService,
      { provide: getRepositoryToken(Exercise), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn((dto) => dto), save: jest.fn(), softRemove: jest.fn() } },
      { provide: getRepositoryToken(Metric), useValue: { existsBy: jest.fn() } },
    ] }).compile();
    service = module.get(ExercisesService);
    exerciseRepo = module.get(getRepositoryToken(Exercise));
    metricRepo = module.get(getRepositoryToken(Metric));
  });

  it('cria exercício após validar suas métricas', async () => {
    metricRepo.existsBy.mockResolvedValue(true);
    const exercise = makeExercise();
    exerciseRepo.save.mockResolvedValue(exercise);
    await expect(service.create({ name: exercise.name, metric1Id: 1 })).resolves.toEqual(exercise);
    expect(metricRepo.existsBy).toHaveBeenCalledWith({ id: 1 });
  });

  it('rejeita exercício quando uma métrica não existe', async () => {
    metricRepo.existsBy.mockResolvedValue(false);
    await expect(service.create({ name: 'Agachamento', metric1Id: 99 })).rejects.toThrow(NotFoundException);
  });

  it('lista somente os campos públicos e remove logicamente o existente', async () => {
    const exercise = makeExercise();
    exerciseRepo.find.mockResolvedValue([exercise]);
    exerciseRepo.findOne.mockResolvedValue(exercise);
    await expect(service.findAll()).resolves.toEqual([{
      id: exercise.id,
      name: exercise.name,
      description: exercise.description,
      tenantId: exercise.tenantId,
      metric1Id: exercise.metric1Id,
      metric2Id: exercise.metric2Id,
      visualUrl: exercise.visualUrl,
    }]);
    await service.remove(1);
    expect(exerciseRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    expect(exerciseRepo.softRemove).toHaveBeenCalledWith(exercise);
  });

  it('retorna alterações ativas e IDs removidos desde uma data', async () => {
    const since = new Date('2026-07-31T10:00:00.000Z');
    const exercise = makeExercise();
    exerciseRepo.find
      .mockResolvedValueOnce([exercise])
      .mockResolvedValueOnce([{ id: 2 } as Exercise]);

    await expect(service.findChangesSince(since)).resolves.toEqual({
      exercises: [{
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        tenantId: exercise.tenantId,
        metric1Id: exercise.metric1Id,
        metric2Id: exercise.metric2Id,
        visualUrl: exercise.visualUrl,
      }],
      deletedIds: [2],
      syncedAt: expect.any(String),
    });
    expect(exerciseRepo.find).toHaveBeenNthCalledWith(1, expect.objectContaining({
      withDeleted: true,
    }));
    expect(exerciseRepo.find).toHaveBeenNthCalledWith(2, expect.objectContaining({
      withDeleted: true,
      select: { id: true },
    }));
  });

  it('retorna catálogo completo quando since é nulo', async () => {
    const exercise = makeExercise({ id: 10, name: 'Supino reto' });
    exerciseRepo.find.mockResolvedValue([exercise]);

    await expect(service.findChangesSince(null)).resolves.toEqual({
      exercises: [{
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        tenantId: exercise.tenantId,
        metric1Id: exercise.metric1Id,
        metric2Id: exercise.metric2Id,
        visualUrl: exercise.visualUrl,
      }],
      deletedIds: [],
      syncedAt: expect.any(String),
    });
    expect(exerciseRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('falha ao buscar exercício inexistente', async () => {
    exerciseRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });
});