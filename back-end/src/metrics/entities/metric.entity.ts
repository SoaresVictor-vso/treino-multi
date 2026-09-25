import { enums } from '@treino-multi/shared';
const { MetricFieldType } = enums;
type MetricFieldType = enums.MetricFieldType;
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';


@Entity('metrics')
export class Metric {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar', length: 10, unique: true })
	name!: string;

	@Column({ type: 'varchar', length: 6 })
	symbol!: string;

	@Column({
		name: 'field_type',
		type: 'enum',
		enum: MetricFieldType,
		enumName: 'metric_field_type_enum',
	})
	fieldType!: MetricFieldType;
}
