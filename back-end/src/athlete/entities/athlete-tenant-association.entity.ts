import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { AthleteTenantStatus } from '../../common/enums/athlete-tenant-status.enum';
import { AthleteReadScope } from '../../common/enums/athlete-read-scope.enum';

@Entity('athlete_tenant_associations')
export class AthleteTenantAssociation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'athlete_id', type: 'uuid' }) athleteId!: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @Column({ name: 'invited_email', type: 'varchar', nullable: true }) invitedEmail!: string | null;
  @Column({ type: 'enum', enum: AthleteTenantStatus, enumName: 'athlete_tenant_status_enum' }) status!: AthleteTenantStatus;
  @Column({ type: 'enum', enum: AthleteReadScope, enumName: 'athlete_read_scope_enum', default: AthleteReadScope.PRESCRIBED_BY_TENANT }) scope!: AthleteReadScope;
  @Column({ name: 'invited_at', type: 'timestamptz' }) invitedAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true }) acceptedAt!: Date | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true }) endedAt!: Date | null;
  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true }) invitedByUserId!: string | null;
  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true }) acceptedByUserId!: string | null;
  @Column({ name: 'ended_by_user_id', type: 'uuid', nullable: true }) endedByUserId!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'athlete_id' }) athlete!: User;
  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'tenant_id' }) tenant!: Tenant;
}
