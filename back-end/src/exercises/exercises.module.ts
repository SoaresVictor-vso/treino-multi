import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from '../metrics/entities/metric.entity';
import { Exercise } from './entities/exercise.entity';
import { ExercisesService } from './exercises.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, Metric])],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}