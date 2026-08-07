import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Histórico de responsabilidade de um treinador sobre um atleta. */
@Entity('athlete_trainer_associations')
export class AthleteTrainerAssociation {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'athlete_id', type: 'uuid' })
	athleteId!: string;

	@Column({ name: 'treinador_id', type: 'uuid' })
	trainerId!: string;

	@Column({ name: 'data_inicio', type: 'date' })
	startDate!: string;

	@Column({ name: 'data_fim', type: 'date', nullable: true })
	endDate!: string | null;

	@Column({ name: 'usuario_inicio_id', type: 'uuid' })
	startedByUserId!: string;

	@Column({ name: 'usuario_fim_id', type: 'uuid', nullable: true })
	endedByUserId!: string | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'athlete_id' })
	athlete!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'treinador_id' })
	trainer!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'usuario_inicio_id' })
	startedByUser!: User;

	@ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
	@JoinColumn({ name: 'usuario_fim_id' })
	endedByUser!: User | null;
}
