import {
	Check,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	type ValueTransformer,
} from 'typeorm';
import { ExerciseGroup } from '../../exercise-groups/entities/exercise-group.entity';
import { Exercise } from '../../exercises/entities/exercise.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

const numericTransformer: ValueTransformer = {
	to: (value: number) => value,
	from: (value: string | number) => Number(value),
};

@Entity('personal_records')
@Check('"value" > 0')
@Check(`("exercise_group_id" IS NULL) <> ("exercise_id" IS NULL)`)
@Index(['athleteId', 'exerciseGroupId'], {
	unique: true,
	where: '"deleted_at" IS NULL AND "exercise_group_id" IS NOT NULL',
})
@Index(['athleteId', 'exerciseId'], {
	unique: true,
	where: '"deleted_at" IS NULL AND "exercise_group_id" IS NULL',
})
export class PersonalRecord {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'athlete_id', type: 'uuid' })
	athleteId!: string;

	@Column({ name: 'exercise_group_id', type: 'integer', nullable: true })
	exerciseGroupId!: number | null;

	@Column({ name: 'exercise_id', type: 'integer', nullable: true })
	exerciseId!: number | null;

	@Column({ type: 'numeric', transformer: numericTransformer })
	value!: number;

	@Column({ name: 'measured_at', type: 'date' })
	measuredAt!: string;

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

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'athlete_id' })
	athlete!: User;

	@ManyToOne(() => ExerciseGroup, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_group_id' })
	exerciseGroup!: ExerciseGroup | null;

	@ManyToOne(() => Exercise, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'exercise_id' })
	exercise!: Exercise | null;
}
