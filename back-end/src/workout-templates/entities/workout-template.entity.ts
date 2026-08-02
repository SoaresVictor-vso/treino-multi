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
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { Activity } from './activity.entity';

@Entity('workout_templates')
export class WorkoutTemplate {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'created_by', type: 'uuid' })
	createdBy!: string;

	@Column({ name: 'updated_by', type: 'uuid' })
	updatedBy!: string;

	@Column({ type: 'varchar' })
	name!: string;

	@Column({ type: 'text', default: '' })
	description!: string;

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
	@JoinColumn({ name: 'created_by' })
	creator!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'updated_by' })
	updater!: User;

	@OneToMany(() => Activity, (activity) => activity.workoutTemplate, {
		cascade: true,
	})
	activities!: Activity[];
}
