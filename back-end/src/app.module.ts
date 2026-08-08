import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration, { configValidationSchema } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PersonsModule } from './persons/persons.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { MetricsModule } from './metrics/metrics.module';
import { ExercisesModule } from './exercises/exercises.module';
import { WorkoutTemplatesModule } from './workout-templates/workout-templates.module';
import { AthleteModule } from './athlete/athlete.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { ExerciseGroupsModule } from './exercise-groups/exercise-groups.module';
import { PersonalRecordsModule } from './personal-records/personal-records.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [configuration],
			validationSchema: configValidationSchema,
			validationOptions: { allowUnknown: true, abortEarly: true },
		}),
		DatabaseModule,
		AuthModule,
		PersonsModule,
		TenantsModule,
		UsersModule,
		RolesModule,
		AuditLogsModule,
		MetricsModule,
		ExercisesModule,
		ExerciseGroupsModule,
		PersonalRecordsModule,
		WorkoutTemplatesModule,
		AthleteModule,
		WorkoutsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
