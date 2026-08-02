import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { Metric } from '../../metrics/entities/metric.entity';

@Entity('exercises')
export class Exercise {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar', length: 50 })
	name!: string;

	@Column({ name: 'description', type: 'text', default: '' })
	description!: string;

	@Column({ name: 'tenant_id', type: 'uuid', nullable: true, default: null })
	tenantId!: string | null;

	@Column({ name: 'metric_1_id', type: 'integer' })
	metric1Id!: number;

	@Column({ name: 'metric_2_id', type: 'integer', nullable: true })
	metric2Id!: number | null;

	@Column({ name: 'visual_url', type: 'varchar', length: 100, nullable: true })
	visualUrl!: string | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@DeleteDateColumn({ name: 'deleted_at' })
	deletedAt!: Date | null;

	@ManyToOne(() => Metric, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_1_id' })
	metric1!: Metric;

	@ManyToOne(() => Metric, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_2_id' })
	metric2!: Metric | null;
}
