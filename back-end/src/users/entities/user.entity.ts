import { types } from '@treino-multi/shared';
export type UserContext = types.UserContext;
import {
	Check,
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
import { Person } from '../../persons/entities/person.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { UserRole } from './user-role.entity';
import { RefreshToken } from './refresh-token.entity';




@Entity('users')
@Check(`"context" IN ('organization','tenant','standalone')`)
export class User {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'person_id', type: 'uuid' })
	personId!: string;

	@Column({ name: 'tenant_id', type: 'uuid', nullable: true })
	tenantId!: string | null;

	@Column({ type: 'varchar' })
	context!: UserContext;

	@Column({ name: 'password_hash', type: 'varchar', nullable: true })
	passwordHash!: string | null;

	@Column({ name: 'is_active', type: 'boolean', default: true })
	isActive!: boolean;

	@Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
	lastLoginAt!: Date | null;

	@DeleteDateColumn({ name: 'deleted_at', nullable: true })
	deletedAt!: Date | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@ManyToOne(() => Person, (person) => person.users, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'person_id' })
	person!: Person;

	@ManyToOne(() => Tenant, (tenant) => tenant.users, {
		onDelete: 'RESTRICT',
		nullable: true,
	})
	@JoinColumn({ name: 'tenant_id' })
	tenant!: Tenant | null;

	@OneToMany(() => UserRole, (ur) => ur.user)
	userRoles!: UserRole[];

	@OneToMany(() => RefreshToken, (rt) => rt.user)
	refreshTokens!: RefreshToken[];
}
