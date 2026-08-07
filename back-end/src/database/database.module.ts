import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../persons/entities/person.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { AuthenticationLog } from '../audit-logs/entities/authentication-log.entity';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { PasswordChangeLog } from '../audit-logs/entities/password-change-log.entity';
import { LogContextType } from '../audit-logs/entities/log-context-type.entity';
import { Metric } from '../metrics/entities/metric.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { WorkoutTemplate } from '../workout-templates/entities/workout-template.entity';
import { Activity } from '../workout-templates/entities/activity.entity';
import { AthleteTrainerAssociation } from '../athlete/entities/athlete-trainer-association.entity';
import { Workout } from '../workouts/entities/workout.entity';
import { Execution } from '../workouts/entities/execution.entity';
import { WorkoutExerciseNote } from '../workouts/entities/workout-exercise-note.entity';
import { DatabaseSyncService } from './database-sync.service';

@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				type: 'postgres',
				host: config.get<string>('database.host'),
				port: config.get<number>('database.port'),
				username: config.get<string>('database.user'),
				password: config.get<string>('database.password'),
				database: config.get<string>('database.name'),
				entities: [
					Person,
					Tenant,
					User,
					UserRole,
					RefreshToken,
					AuditLog,
					AuthenticationLog,
					CriticalOperationLog,
					PasswordChangeLog,
					LogContextType,
					Metric,
					Exercise,
					WorkoutTemplate,
					Activity,
					AthleteTrainerAssociation,
					Workout,
					Execution,
					WorkoutExerciseNote,
				],
				migrations: [__dirname + '/migrations/*{.ts,.js}'],
				migrationsRun: true,
				synchronize: false,
				logging: config.get<string>('nodeEnv') === 'development',
			}),
		}),
		TypeOrmModule.forFeature([UserRole, CriticalOperationLog]),
	],
	providers: [DatabaseSyncService],
	exports: [DatabaseSyncService],
})
export class DatabaseModule {}
