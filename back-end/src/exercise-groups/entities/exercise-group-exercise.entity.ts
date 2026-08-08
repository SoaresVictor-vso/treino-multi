import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { User } from '../../users/entities/user.entity';
import { ExerciseGroup } from './exercise-group.entity';

@Entity('exercise_group_exercises')
@Index(['exerciseGroupId', 'exerciseId'], {
	unique: true,
	where: '"deleted_at" IS NULL',
})
export class ExerciseGroupExercise {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ name: 'exercise_group_id', type: 'integer' })
	exerciseGroupId!: number;

	@Column({ name: 'exercise_id', type: 'integer' })
	exerciseId!: number;

	@Column({ name: 'created_by', type: 'uuid' })
	createdBy!: string;

	@Column({ name: 'deleted_by', type: 'uuid', nullable: true })
	deletedBy!: string | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@DeleteDateColumn({ name: 'deleted_at' })
	deletedAt!: Date | null;

	@ManyToOne(() => ExerciseGroup, (group) => group.exerciseMemberships, {
		onDelete: 'RESTRICT',
	})
	@JoinColumn({ name: 'exercise_group_id' })
	exerciseGroup!: ExerciseGroup;

	@ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'created_by' })
	creator!: User;
}
