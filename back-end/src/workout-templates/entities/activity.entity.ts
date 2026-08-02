import {
	Check,
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { WorkoutTemplate } from './workout-template.entity';

export type RegisterType = 'p' | 'v';

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

	@Column({ name: 'metric_1', type: 'numeric', nullable: true })
	metric1!: number | null;

	@Column({ name: 'metric_2', type: 'numeric', nullable: true })
	metric2!: number | null;

	@Column({ name: 'type_1', type: 'varchar', length: 1, default: 'v' })
	type1!: 'v';

	@Column({ name: 'type_2', type: 'varchar', length: 1, nullable: true })
	type2!: RegisterType | null;

	@Column({ type: 'numeric' })
	pse!: number;

	@Column({ name: 'rest_duration', type: 'integer', nullable: true })
	restDuration!: number | null;

	@Column({ type: 'text', nullable: true })
	note!: string | null;

	@ManyToOne(() => WorkoutTemplate, (template) => template.activities, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'workout_template_id' })
	workoutTemplate!: WorkoutTemplate;

	@ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise;
}
