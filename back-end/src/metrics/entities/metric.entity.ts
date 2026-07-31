import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MetricFieldType } from '../../common/enums/metric-field-type.enum';

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