import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { User } from '../../users/entities/user.entity';
import { Workout } from './workout.entity';

@Entity('workout_exercise_notes')
@Index(['workoutId', 'exerciseId'], { unique: true })
export class WorkoutExerciseNote {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ name: 'workout_id', type: 'uuid' })
	workoutId!: string;

	@Column({ name: 'exercise_id', type: 'integer' })
	exerciseId!: number;

	@Column({ type: 'text' })
	note!: string;

	@Column({ name: 'created_by', type: 'uuid' })
	createdBy!: string;

	@Column({ name: 'updated_by', type: 'uuid' })
	updatedBy!: string;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@ManyToOne(() => Workout, (workout) => workout.exerciseNotes, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'workout_id' })
	workout!: Workout;

	@ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'created_by' })
	creator!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'updated_by' })
	updater!: User;
}
