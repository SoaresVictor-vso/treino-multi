import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMetricDto } from './dto/create-metric.dto';
import { UpdateMetricDto } from './dto/update-metric.dto';
import { Metric } from './entities/metric.entity';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Metric)
    private readonly metricRepo: Repository<Metric>,
  ) {}

  async create(dto: CreateMetricDto): Promise<Metric> {
    const existing = await this.metricRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Métrica ${dto.name} já existe.`);
    return this.metricRepo.save(this.metricRepo.create(dto));
  }

  findAll(): Promise<Metric[]> {
    return this.metricRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Metric> {
    const metric = await this.metricRepo.findOne({ where: { id } });
    if (!metric) throw new NotFoundException(`Métrica ${id} não encontrada.`);
    return metric;
  }

  async update(id: number, dto: UpdateMetricDto): Promise<Metric> {
    const metric = await this.findOne(id);
    if (dto.name && dto.name !== metric.name) {
      const existing = await this.metricRepo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Métrica ${dto.name} já existe.`);
    }
    return this.metricRepo.save(Object.assign(metric, dto));
  }

  async remove(id: number): Promise<void> {
    await this.metricRepo.remove(await this.findOne(id));
  }
}