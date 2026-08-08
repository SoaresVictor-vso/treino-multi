import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { WorkoutsModule } from '../workouts/workouts.module';
import { UsersModule } from '../users/users.module';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { AthleteTrainerAssociation } from './entities/athlete-trainer-association.entity';
import { AthleteController } from './athlete.controller';
import { AthleteService } from './athlete.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, AthleteTrainerAssociation, WorkoutTemplate]),
		WorkoutsModule,
		UsersModule,
	],
	controllers: [AthleteController],
	providers: [AthleteService],
})
export class AthleteModule {}
