import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Metric } from '../metrics/entities/metric.entity';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Exercise } from './entities/exercise.entity';
import { ReadExercise } from './entities/read-exercise.entity';

export interface ExerciseChanges {
	exercises: ReadExercise[];
	deletedIds: number[];
	syncedAt: string;
}

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
		return this.exerciseRepo.save(
			this.exerciseRepo.create({ ...dto, name: dto.name.toUpperCase() }),
		);
	}

	async findAll(): Promise<ReadExercise[]> {
		const exercises = await this.exerciseRepo.find({ order: { name: 'ASC' } });
		return exercises.map((exercise) => this.toReadModel(exercise));
	}

	async findChangesSince(since: Date | null): Promise<ExerciseChanges> {
		if (!since) {
			const exercises = await this.exerciseRepo.find({ order: { name: 'ASC' } });
			return {
				exercises: exercises.map((exercise) => this.toReadModel(exercise)),
				deletedIds: [],
				syncedAt: new Date().toISOString(),
			};
		}

		const [exercises, deletedExercises] = await Promise.all([
			this.exerciseRepo.find({
				withDeleted: true,
				where: [
					{ createdAt: MoreThan(since), deletedAt: IsNull() },
					{ updatedAt: MoreThan(since), deletedAt: IsNull() },
				],
				order: { updatedAt: 'ASC' },
			}),
			this.exerciseRepo.find({
				withDeleted: true,
				where: { deletedAt: MoreThan(since) },
				select: { id: true },
			}),
		]);

		return {
			exercises: exercises.map((exercise) => this.toReadModel(exercise)),
			deletedIds: deletedExercises.map((exercise) => exercise.id),
			syncedAt: new Date().toISOString(),
		};
	}

	async findOne(id: number): Promise<Exercise> {
		const exercise = await this.exerciseRepo.findOne({
			where: { id },
			relations: ['metric1', 'metric2'],
		});
		if (!exercise) throw new NotFoundException(`Exercício ${id} não encontrado.`);
		return exercise;
	}

	async update(id: number, dto: UpdateExerciseDto): Promise<Exercise> {
		const exercise = await this.findOne(id);
		await this.ensureMetrics(
			dto.metric1Id ?? exercise.metric1Id,
			dto.metric2Id ?? exercise.metric2Id,
		);
		return this.exerciseRepo.save(
			Object.assign(exercise, {
				...dto,
				...(dto.name !== undefined ? { name: dto.name.toUpperCase() } : {}),
			}),
		);
	}

	async remove(id: number): Promise<void> {
		await this.exerciseRepo.softRemove(await this.findOne(id));
	}

	private async ensureMetrics(
		metric1Id: number,
		metric2Id?: number | null,
	): Promise<void> {
		await this.ensureMetric(metric1Id);
		if (metric2Id) await this.ensureMetric(metric2Id);
	}

	private async ensureMetric(id: number): Promise<void> {
		if (!(await this.metricRepo.existsBy({ id }))) {
			throw new NotFoundException(`Métrica ${id} não encontrada.`);
		}
	}

	private toReadModel(exercise: Exercise): ReadExercise {
		return Object.assign(new ReadExercise(), {
			id: exercise.id,
			name: exercise.name,
			description: exercise.description,
			tenantId: exercise.tenantId,
			metric1Id: exercise.metric1Id,
			metric2Id: exercise.metric2Id,
			visualUrl: exercise.visualUrl,
		});
	}
}
