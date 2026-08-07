import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { WorkoutStatus } from '../../common/enums/workout-status.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { WorkoutTemplate } from '../../workout-templates/entities/workout-template.entity';
import { Execution } from './execution.entity';
import { WorkoutExerciseNote } from './workout-exercise-note.entity';

@Entity('workouts')
@Index(['athleteId', 'scheduledDate'])
@Index(['tenantId', 'status', 'scheduledDate'])
export class Workout {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'athlete_id', type: 'uuid' })
	athleteId!: string;

	@Column({ name: 'workout_template_id', type: 'uuid', nullable: true })
	workoutTemplateId!: string | null;

	@Column({ name: 'template_name', type: 'varchar' })
	templateName!: string;

	@Column({ name: 'template_description', type: 'text', default: '' })
	templateDescription!: string;

	@Column({ name: 'scheduled_date', type: 'date', nullable: true })
	scheduledDate!: string | null;

	@Column({ name: 'performed_at', type: 'timestamptz', nullable: true })
	performedAt!: Date | null;

	@Column({
		type: 'enum',
		enum: WorkoutStatus,
		enumName: 'workout_status_enum',
		default: WorkoutStatus.SCHEDULED,
	})
	status!: WorkoutStatus;

	@Column({ name: 'created_by', type: 'uuid' })
	createdBy!: string;

	@Column({ name: 'updated_by', type: 'uuid' })
	updatedBy!: string;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'tenant_id' })
	tenant!: Tenant;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'athlete_id' })
	athlete!: User;

	@ManyToOne(() => WorkoutTemplate, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'workout_template_id' })
	workoutTemplate!: WorkoutTemplate | null;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'created_by' })
	creator!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'updated_by' })
	updater!: User;

	@OneToMany(() => Execution, (execution) => execution.workout)
	executions!: Execution[];

	@OneToMany(() => WorkoutExerciseNote, (note) => note.workout)
	exerciseNotes!: WorkoutExerciseNote[];
}
