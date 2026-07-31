import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../metrics/entities/metric.entity';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Exercise } from './entities/exercise.entity';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(Metric)
    private readonly metricRepo: Repository<Metric>,
  ) {}

  async create(dto: CreateExerciseDto): Promise<Exercise> {
    await this.ensureMetrics(dto.metric1Id, dto.metric2Id);
    return this.exerciseRepo.save(this.exerciseRepo.create(dto));
  }

  findAll(): Promise<Exercise[]> {
    return this.exerciseRepo.find({ relations: ['metric1', 'metric2'], order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Exercise> {
    const exercise = await this.exerciseRepo.findOne({ where: { id }, relations: ['metric1', 'metric2'] });
    if (!exercise) throw new NotFoundException(`Exercício ${id} não encontrado.`);
    return exercise;
  }

  async update(id: number, dto: UpdateExerciseDto): Promise<Exercise> {
    const exercise = await this.findOne(id);
    await this.ensureMetrics(dto.metric1Id ?? exercise.metric1Id, dto.metric2Id ?? exercise.metric2Id);
    return this.exerciseRepo.save(Object.assign(exercise, dto));
  }

  async remove(id: number): Promise<void> {
    await this.exerciseRepo.softRemove(await this.findOne(id));
  }

  private async ensureMetrics(metric1Id: number, metric2Id?: number | null): Promise<void> {
    await this.ensureMetric(metric1Id);
    if (metric2Id) await this.ensureMetric(metric2Id);
  }

  private async ensureMetric(id: number): Promise<void> {
    if (!(await this.metricRepo.existsBy({ id }))) {
      throw new NotFoundException(`Métrica ${id} não encontrada.`);
    }
  }
}