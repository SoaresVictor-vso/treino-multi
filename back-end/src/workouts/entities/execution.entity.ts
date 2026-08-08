import {
	Column,
	Check,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	type ValueTransformer,
} from 'typeorm';
import { ExecutionStatus } from '../../common/enums/execution-status.enum';
import { Exercise } from '../../exercises/entities/exercise.entity';
import type { RegisterType } from '../../workout-templates/entities/activity.entity';
import { Workout } from './workout.entity';

const numericTransformer: ValueTransformer = {
	to: (value: number | null) => value,
	from: (value: string | number | null) => Number(value ?? 0),
};

/** Série prescrita pela template ou criada durante o workout. */
@Entity('executions')
@Index(['workoutId', 'position'], { unique: true })
@Check(`"metric1_type" = 'v'`)
@Check(`"metric2_type" IS NULL OR "metric2_type" IN ('p', 'v')`)
export class Execution {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ name: 'workout_id', type: 'uuid' })
	workoutId!: string;

	@Column({ name: 'exercise_id', type: 'integer' })
	exerciseId!: number;

	@Column({ type: 'integer' })
	position!: number;

	@Column({
		name: 'prescribed_metric_1',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	prescribedMetric1!: number | null;

	@Column({
		name: 'prescribed_metric_2',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	prescribedMetric2!: number | null;

	@Column({ name: 'metric1_type', type: 'varchar', length: 1, default: 'v' })
	metric1Type!: 'v';

	@Column({ name: 'metric2_type', type: 'varchar', length: 1, nullable: true })
	metric2Type!: RegisterType | null;

	@Column({
		name: 'prescribed_pse',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	prescribedPse!: number | null;

	@Column({ name: 'prescribed_rest_duration', type: 'integer', nullable: true })
	prescribedRestDuration!: number | null;

	@Column({
		name: 'performed_metric_1',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	performedMetric1!: number | null;

	@Column({
		name: 'performed_metric_2',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	performedMetric2!: number | null;

	@Column({
		name: 'performed_pse',
		type: 'numeric',
		nullable: true,
		transformer: numericTransformer,
	})
	performedPse!: number | null;

	@Column({ name: 'performed_rest_duration', type: 'integer', nullable: true })
	performedRestDuration!: number | null;

	@Column({ name: 'performed_note', type: 'text', nullable: true })
	performedNote!: string | null;

	@Column({
		type: 'enum',
		enum: ExecutionStatus,
		enumName: 'execution_status_enum',
		default: ExecutionStatus.PENDING,
	})
	status!: ExecutionStatus;

	@Column({ name: 'started_at', type: 'timestamptz', nullable: true })
	startedAt!: Date | null;

	@Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
	finishedAt!: Date | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@ManyToOne(() => Workout, (workout) => workout.executions, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'workout_id' })
	workout!: Workout;

	@ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise;
}
