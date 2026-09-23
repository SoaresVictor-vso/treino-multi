import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Workout } from '../../workouts/entities/workout.entity';
import { Measurement, type MeasurementPresentation } from './measurement.entity';

export type MeasurementSnapshot = {
	key: string;
	name: string;
	icon: string;
	presentation: MeasurementPresentation;
};

@Entity('workout_measurements')
@Index(['workoutId', 'measurementId'], { unique: true })
export class WorkoutMeasurement {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'workout_id', type: 'uuid' })
	workoutId!: string;

	@Column({ name: 'measurement_id', type: 'uuid' })
	measurementId!: string;

	@Column({ type: 'numeric' })
	value!: number;

	@Column({ type: 'numeric' })
	score!: number;

	@Column({ name: 'considered_sets', type: 'integer', default: 0 })
	consideredSets!: number;

	@Column({ type: 'jsonb' })
	snapshot!: MeasurementSnapshot;

	@ManyToOne(() => Workout, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'workout_id' })
	workout!: Workout;

	@ManyToOne(() => Measurement, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'measurement_id' })
	measurement!: Measurement;
}
