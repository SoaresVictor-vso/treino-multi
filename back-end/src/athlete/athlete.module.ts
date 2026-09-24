import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AthleteTrainerAssociation } from './entities/athlete-trainer-association.entity';
import { AthleteController } from './athlete.controller';
import { AthleteService } from './athlete.service';
import { AnalysisModule } from './analysis/analysis.module';
import { AthleteTenantAssociation } from './entities/athlete-tenant-association.entity';
import { AthleteTenantAssociationsService } from './athlete-tenant-associations.service';
import { AthleteTenantAssociationsController } from './athlete-tenant-associations.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, AthleteTrainerAssociation, AthleteTenantAssociation]),
		UsersModule,
		AnalysisModule,
	],
	controllers: [AthleteController, AthleteTenantAssociationsController],
	providers: [AthleteService, AthleteTenantAssociationsService],
})
export class AthleteModule {}
