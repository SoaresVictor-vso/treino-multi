import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { ExerciseGroup } from '../exercise-groups/entities/exercise-group.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { User } from '../users/entities/user.entity';
import { PersonalRecord } from './entities/personal-record.entity';
import { PersonalRecordsController } from './personal-records.controller';
import { PersonalRecordsService } from './personal-records.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			PersonalRecord,
			ExerciseGroup,
			Exercise,
			User,
			AthleteTrainerAssociation,
		]),
	],
	controllers: [PersonalRecordsController],
	providers: [PersonalRecordsService],
})
export class PersonalRecordsModule {}
