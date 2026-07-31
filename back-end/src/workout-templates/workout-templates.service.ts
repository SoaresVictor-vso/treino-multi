import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { CreateWorkoutTemplateDto } from './dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './dto/update-workout-template.dto';
import { Activity } from './entities/activity.entity';
import { WorkoutTemplate } from './entities/workout-template.entity';

@Injectable()
export class WorkoutTemplatesService {
  constructor(
    @InjectRepository(WorkoutTemplate)
    private readonly templateRepo: Repository<WorkoutTemplate>,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateWorkoutTemplateDto): Promise<WorkoutTemplate> {
    await this.ensureExercises(dto.activities);
    return this.dataSource.transaction(async (manager) => {
      const template = await manager.save(WorkoutTemplate, manager.create(WorkoutTemplate, dto));
      if (dto.activities.length) {
        await manager.save(Activity, dto.activities.map((activity) => manager.create(Activity, { ...activity, workoutTemplateId: template.id })));
      }
      return this.getOneOrFail(template.id, manager);
    });
  }

  findAll(): Promise<WorkoutTemplate[]> {
    return this.templateRepo.find({ relations: ['activities', 'activities.exercise'], order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<WorkoutTemplate> {
    return this.getOneOrFail(id, this.templateRepo.manager);
  }

  async update(id: string, dto: UpdateWorkoutTemplateDto): Promise<WorkoutTemplate> {
    const template = await this.findOne(id);
    if (dto.activities) await this.ensureExercises(dto.activities);
    return this.dataSource.transaction(async (manager) => {
      await manager.save(WorkoutTemplate, Object.assign(template, dto));
      if (dto.activities) {
        await manager.delete(Activity, { workoutTemplateId: id });
        if (dto.activities.length) {
          await manager.save(Activity, dto.activities.map((activity) => manager.create(Activity, { ...activity, workoutTemplateId: id })));
        }
      }
      return this.getOneOrFail(id, manager);
    });
  }

  async remove(id: string): Promise<void> {
    await this.templateRepo.softRemove(await this.findOne(id));
  }

  private async ensureExercises(activities: { exerciseId: number }[]): Promise<void> {
    const exerciseIds = [...new Set(activities.map((activity) => activity.exerciseId))];
    if (!exerciseIds.length) return;
    const count = await this.exerciseRepo.countBy({ id: In(exerciseIds) });
    if (count !== exerciseIds.length) throw new NotFoundException('Um ou mais exercícios não foram encontrados.');
  }

  private async getOneOrFail(id: string, manager: EntityManager): Promise<WorkoutTemplate> {
    const template = await manager.findOne(WorkoutTemplate, {
      where: { id },
      relations: ['activities', 'activities.exercise'],
    });
    if (!template) throw new NotFoundException(`Template de treino ${id} não encontrado.`);
    return template;
  }
}