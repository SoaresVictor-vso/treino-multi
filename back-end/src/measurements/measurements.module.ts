import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Measurement } from './entities/measurement.entity';
import { WorkoutMeasurement } from './entities/workout-measurement.entity';
import { Metric } from '../metrics/entities/metric.entity';
import { MeasurementsService } from './measurements.service';

@Module({
	imports: [TypeOrmModule.forFeature([Measurement, WorkoutMeasurement, Metric])],
	providers: [MeasurementsService],
	exports: [MeasurementsService, TypeOrmModule],
})
export class MeasurementsModule {}
