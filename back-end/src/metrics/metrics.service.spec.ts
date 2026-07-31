import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricFieldType } from '../common/enums/metric-field-type.enum';
import { Metric } from './entities/metric.entity';
import { MetricsService } from './metrics.service';

const makeMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: 1, name: 'repeticoes', symbol: 'reps', fieldType: MetricFieldType.INT, ...overrides,
});

describe('MetricsService', () => {
  let service: MetricsService;
  let repo: jest.Mocked<Repository<Metric>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MetricsService, { provide: getRepositoryToken(Metric), useValue: {
        findOne: jest.fn(), find: jest.fn(), create: jest.fn((dto) => dto), save: jest.fn(), remove: jest.fn(),
      } }],
    }).compile();
    service = module.get(MetricsService);
    repo = module.get(getRepositoryToken(Metric));
  });

  it('cria uma métrica sem nome duplicado', async () => {
    const metric = makeMetric();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue(metric);
    await expect(service.create(metric)).resolves.toEqual(metric);
    expect(repo.create).toHaveBeenCalledWith(metric);
  });

  it('rejeita criação com nome duplicado', async () => {
    repo.findOne.mockResolvedValue(makeMetric());
    await expect(service.create(makeMetric())).rejects.toThrow(ConflictException);
  });

  it('lista métricas ordenadas por nome', async () => {
    repo.find.mockResolvedValue([makeMetric()]);
    await expect(service.findAll()).resolves.toHaveLength(1);
    expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('busca, atualiza e remove uma métrica existente', async () => {
    const metric = makeMetric();
    repo.findOne.mockResolvedValue(metric);
    repo.save.mockResolvedValue({ ...metric, symbol: 'r' });
    await expect(service.findOne(1)).resolves.toEqual(metric);
    await expect(service.update(1, { symbol: 'r' })).resolves.toMatchObject({ symbol: 'r' });
    await service.remove(1);
    expect(repo.remove).toHaveBeenCalledWith(metric);
  });

  it('falha para métrica inexistente', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
  });
});