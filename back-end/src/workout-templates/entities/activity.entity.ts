import {
	Check,
	Column,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	type ValueTransformer,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { WorkoutTemplate } from './workout-template.entity';

export type RegisterType = 'p' | 'v';

const numericResponseTransformer: ValueTransformer = {
	to: (value: number | null) => value,
	from: (value: string | number | null) => Number(value ?? 0),
};

@Entity('activities')
@Check(`"type_1" = 'v'`)
@Check(`"type_2" IS NULL OR "type_2" IN ('p', 'v')`)
export class Activity {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ name: 'workout_template_id', type: 'uuid' })
	workoutTemplateId!: string;

	@Column({ name: 'exercise_id', type: 'integer' })
	exerciseId!: number;

	@Column({ type: 'integer' })
	position!: number;

	@Column({
		name: 'metric_1',
		type: 'numeric',
		nullable: true,
		transformer: numericResponseTransformer,
	})
	metric1!: number;

	@Column({
		name: 'metric_2',
		type: 'numeric',
		nullable: true,
		transformer: numericResponseTransformer,
	})
	metric2!: number;

	@Column({ name: 'type_1', type: 'varchar', length: 1, default: 'v' })
	type1!: 'v';

	@Column({ name: 'type_2', type: 'varchar', length: 1, nullable: true })
	type2!: RegisterType | null;

	@Column({ type: 'numeric', transformer: numericResponseTransformer })
	pse!: number;

	@Column({ name: 'rest_duration', type: 'integer', nullable: true })
	restDuration!: number | null;

	@Column({ type: 'text', nullable: true })
	note!: string | null;

	@DeleteDateColumn({ name: 'deleted_at' })
	deletedAt!: Date | null;

	@ManyToOne(() => WorkoutTemplate, (template) => template.activities, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'workout_template_id' })
	workoutTemplate!: WorkoutTemplate;

	@ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise;
}
