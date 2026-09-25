import { enums } from '@treino-multi/shared';
const { Role } = enums;
type Role = enums.Role;
import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('user_roles')
export class UserRole {
	@PrimaryColumn({ name: 'user_id', type: 'uuid' })
	userId: string;

	@PrimaryColumn({ type: 'varchar' })
	role: Role;

	@CreateDateColumn({ name: 'assigned_at' })
	assignedAt: Date;

	@DeleteDateColumn({ name: 'deleted_at', nullable: true })
	deletedAt: Date | null;

	@ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;
}
