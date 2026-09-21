import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Metric } from '../../metrics/entities/metric.entity';

export type MeasurementPresentation = {
	containerClass: string;
	iconClass: string;
	valueClass: string;
	labelClass: string;
};

@Entity('measurements')
export class Measurement {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'varchar', length: 80, unique: true })
	key!: string;

	@Column({ type: 'varchar', length: 120 })
	name!: string;

	@Column({ type: 'boolean', default: true })
	active!: boolean;

	@Column({ name: 'metric_1_id', type: 'integer', nullable: true })
	metric1Id!: number | null;

	@Column({ name: 'metric_2_id', type: 'integer', nullable: true })
	metric2Id!: number | null;

	@Column({ type: 'text' })
	formula!: string;

	@Column({ name: 'value_formula', type: 'text' })
	valueFormula!: string;

	@Column({ name: 'static_weight', type: 'numeric', default: 0 })
	staticWeight!: number;

	@Column({ name: 'dynamic_weight', type: 'numeric', default: 0 })
	dynamicWeight!: number;

	@Column({ type: 'varchar', length: 40 })
	icon!: string;

	@Column({ type: 'jsonb', default: () => "'{}'" })
	presentation!: MeasurementPresentation;

	@ManyToOne(() => Metric, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_1_id' })
	metric1!: Metric | null;

	@ManyToOne(() => Metric, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'metric_2_id' })
	metric2!: Metric | null;
}
