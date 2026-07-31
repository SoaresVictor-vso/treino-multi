import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { WorkoutTemplate } from './entities/workout-template.entity';
import { WorkoutTemplatesService } from './workout-templates.service';

const uuid = 'd2719f58-929d-4c18-b0d5-1ec3213918be';
const makeTemplate = (): WorkoutTemplate => ({
    id: uuid, tenantId: uuid, createdBy: uuid, updatedBy: uuid, name: 'Treino A', description: '', createdAt: new Date(), updatedAt: new Date(), activities: [], tenant: {} as any, creator: {} as any, updater: {} as any,
    deletedAt: null
});

describe('WorkoutTemplatesService', () => {
    let service: WorkoutTemplatesService;
    let templateRepo: jest.Mocked<Repository<WorkoutTemplate>>;
    let exerciseRepo: jest.Mocked<Repository<Exercise>>;
    let manager: jest.Mocked<Pick<EntityManager, 'create' | 'save' | 'findOne' | 'delete'>>;

    beforeEach(async () => {
        manager = {
            create: jest.fn((_entity, value) => value),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
        } as unknown as jest.Mocked<
            Pick<EntityManager, 'create' | 'save' | 'findOne' | 'delete'>
        >;

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
        await expect(service.create({ tenantId: uuid, createdBy: uuid, updatedBy: uuid, name: 'Treino A', description: '', activities: [{ exerciseId: 1, type1: 'v', pse: 8 }] })).resolves.toEqual(template);
        expect(manager.save).toHaveBeenCalledTimes(2);
    });

    it('rejeita template com exercício ausente', async () => {
        exerciseRepo.countBy.mockResolvedValue(0);
        await expect(service.create({ tenantId: uuid, createdBy: uuid, updatedBy: uuid, name: 'Treino A', description: '', activities: [{ exerciseId: 1, type1: 'v', pse: 8 }] })).rejects.toThrow(NotFoundException);
    });

    it('lista, atualiza atividades e remove logicamente o template existente', async () => {
        const template = makeTemplate();
        templateRepo.find.mockResolvedValue([template]);
        templateRepo.findOne.mockResolvedValue(template);
        exerciseRepo.countBy.mockResolvedValue(1);
        manager.findOne.mockResolvedValue(template);
        await expect(service.findAll()).resolves.toEqual([template]);
        await service.update(uuid, { activities: [{ exerciseId: 1, type1: 'v', pse: 7 }] });
        expect(manager.delete).toHaveBeenCalled();
        await service.remove(uuid);
        expect(templateRepo.softRemove).toHaveBeenCalledWith(template);
    });
});