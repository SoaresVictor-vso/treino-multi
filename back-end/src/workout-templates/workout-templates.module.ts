import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Activity } from './entities/activity.entity';
import { WorkoutTemplate } from './entities/workout-template.entity';
import { WorkoutTemplatesController } from './workout-templates.controller';
import { WorkoutTemplatesService } from './workout-templates.service';

@Module({
	imports: [TypeOrmModule.forFeature([WorkoutTemplate, Activity, Exercise])],
	controllers: [WorkoutTemplatesController],
	providers: [WorkoutTemplatesService],
	exports: [WorkoutTemplatesService],
})
export class WorkoutTemplatesModule {}
