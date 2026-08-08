import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExerciseGroupExercise } from './entities/exercise-group-exercise.entity';
import { ExerciseGroup } from './entities/exercise-group.entity';
import { ExerciseGroupsController } from './exercise-groups.controller';
import { ExerciseGroupsService } from './exercise-groups.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([ExerciseGroup, ExerciseGroupExercise, Exercise]),
	],
	controllers: [ExerciseGroupsController],
	providers: [ExerciseGroupsService],
	exports: [TypeOrmModule, ExerciseGroupsService],
})
export class ExerciseGroupsModule {}
