import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { Metric } from '../../metrics/entities/metric.entity';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { ExerciseGroupExercise } from './exercise-group-exercise.entity';

@Entity('exercise_groups')
export class ExerciseGroup {
	/** Relação projetada pelo serviço, contendo somente exercícios ativos. */
	activeExercises?: Exercise[];

	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar', length: 80 })
	name!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'metric_1_id', type: 'integer' })
	metric1Id!: number;

	@Column({ name: 'metric_2_id', type: 'integer', nullable: true })
	metric2Id!: number | null;

	@Column({ name: 'created_by', type: 'uuid' })
	createdBy!: string;

	@Column({ name: 'updated_by', type: 'uuid' })
	updatedBy!: string;

	@Column({ name: 'deleted_by', type: 'uuid', nullable: true })
	deletedBy!: string | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@DeleteDateColumn({ name: 'deleted_at' })
	deletedAt!: Date | null;

	@ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'tenant_id' })
	tenant!: Tenant;

	@ManyToOne(() => Metric, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_1_id' })
	metric1!: Metric;

	@ManyToOne(() => Metric, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_2_id' })
	metric2!: Metric | null;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'created_by' })
	creator!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'updated_by' })
	updater!: User;

	@OneToMany(
		() => ExerciseGroupExercise,
		(membership) => membership.exerciseGroup,
	)
	exerciseMemberships!: ExerciseGroupExercise[];
}
