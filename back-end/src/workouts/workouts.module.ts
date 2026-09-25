import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { UsersModule } from '../users/users.module';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { MeasurementsModule } from '../measurements/measurements.module';
import { WorkoutSyncService } from './workout-sync.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Workout,
			Execution,
			WorkoutExerciseNote,
			AthleteTrainerAssociation,
			WorkoutTemplate,
		]),
		UsersModule,
		MeasurementsModule,
	],
	controllers: [WorkoutsController],
	providers: [WorkoutsService, WorkoutSyncService],
	exports: [TypeOrmModule, WorkoutsService],
})
export class WorkoutsModule {}
