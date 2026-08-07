import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutsService } from './workouts.service';

@Module({
	imports: [TypeOrmModule.forFeature([Workout, Execution, WorkoutExerciseNote])],
	providers: [WorkoutsService],
	exports: [TypeOrmModule, WorkoutsService],
})
export class WorkoutsModule {}
