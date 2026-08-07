import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { WorkoutExerciseNote } from './entities/workout-exercise-note.entity';
import { Workout } from './entities/workout.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Workout, Execution, WorkoutExerciseNote])],
	exports: [TypeOrmModule],
})
export class WorkoutsModule {}
