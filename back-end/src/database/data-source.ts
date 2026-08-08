import { DataSource } from 'typeorm';
import { config } from 'dotenv';
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
import { ExerciseGroup } from '../exercise-groups/entities/exercise-group.entity';
import { ExerciseGroupExercise } from '../exercise-groups/entities/exercise-group-exercise.entity';
import { PersonalRecord } from '../personal-records/entities/personal-record.entity';

config();

export const AppDataSource = new DataSource({
	type: 'postgres',
	host: process.env.DATABASE_HOST,
	port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
	username: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
	database: process.env.DATABASE_NAME,
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
		ExerciseGroup,
		ExerciseGroupExercise,
		PersonalRecord,
	],
	migrations: [__dirname + '/migrations/*{.ts,.js}'],
	synchronize: false,
});
